const axios = require('axios');
const fs = require('fs').promises;
const chalk = require('chalk');
const moment = require('moment-timezone');

class MoneyToon {
    constructor() {
        this.proxies = [];
        this.proxyIndex = 0;
        this.headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Host': 'mt.promptale.io',
            'Origin': 'https://mt.promptale.io',
            'Pragma': 'no-cache',
            'Referer': 'https://mt.promptale.io/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
        };
    }

    async loadProxies() {
        try {
            const data = await fs.readFile('proxies.txt', 'utf8');
            this.proxies = data.split('\\n').filter(line => line.trim());
            console.log(chalk.green(`Loaded ${this.proxies.length} proxies`));
        } catch (error) {
            console.error(chalk.red('Error loading proxies:', error.message));
            process.exit(1);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.proxyIndex].trim();
        this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
        
        try {
            const [host, port] = proxy.split(':');
            if (host && port) {
                return {
                    host: host,
                    port: parseInt(port)
                };
            }
        } catch (error) {
            this.log(chalk.red(`Invalid proxy format: ${proxy}`));
        }
        return null;
    }

    createAxiosInstance(token, accountIndex) {
        const config = {
            baseURL: 'https://mt.promptale.io',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Content-Type': 'application/json',
                'Host': 'mt.promptale.io',
                'Origin': 'https://mt.promptale.io',
                'Pragma': 'no-cache',
                'Referer': 'https://mt.promptale.io/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
            },
            timeout: 10000
        };

        return axios.create(config);
    }

    log(message) {
        const timestamp = moment().tz('Asia/Jakarta').format('MM/DD/YY hh:mm:ss A z');
        console.log(`${chalk.cyan(`[ ${timestamp} ]`)} ${chalk.white('|')} ${message}`);
    }

    async loadQueries() {
        try {
            const data = await fs.readFile('query.txt', 'utf8');
            return data.split('\\n').filter(line => line.trim());
        } catch (error) {
            console.error(chalk.red('Error loading queries:', error.message));
            return [];
        }
    }

    async loadTokens() {
        try {
            const data = await fs.readFile('tokens.json', 'utf8');
            const tokens = JSON.parse(data);
            return tokens.accounts || [];
        } catch (error) {
            return [];
        }
    }

    async saveTokens(tokens) {
        await fs.writeFile('tokens.json', JSON.stringify({ accounts: tokens }, null, 4));
    }

    loadData(query) {
        const params = new URLSearchParams(query);
        const userData = JSON.parse(params.get('user'));
        const firstName = userData.first_name || '';

        return {
            data: {
                authDate: params.get('auth_date'),
                chatInstance: params.get('chat_instance'),
                chatType: params.get('chat_type'),
                hash: params.get('hash'),
                queryId: params.get('query_id'),
                startParam: "2B860D",
                user: {
                    allowsWriteToPm: userData.allows_write_to_pm,
                    firstName: firstName,
                    id: userData.id,
                    languageCode: userData.language_code || '',
                    lastName: userData.last_name || '',
                    photoUrl: userData.photo_url || '',
                    username: userData.username || '',
                }
            },
            first_name: firstName
        };
    }

    async userLogin(query, retries = 5) {
        const url = '/auth/loginTg';
        const data = {
            initData: query,
            initDataUnsafe: this.loadData(query).data
        };

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance();
                const response = await instance.post(url, data);
                return response.data.data.accessToken;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    this.log(chalk.yellow(`Proxy details: ${JSON.stringify(this.getNextProxy())}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async userPoints(token, accountIndex, retries = 5) {
        const url = '/main/mypoint';
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.get(url);
                if (response.status === 401) return null;
                return response.data.data;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR. Retrying ${attempt + 1}/${retries}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async userAttendance(token, accountIndex, retries = 5) {
        const url = '/tasks/isAttendanceToday';
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.get(url);
                return response.data.data;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async claimAttendance(token, accountIndex, retries = 5) {
        const url = '/tasks/attend';
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.post(url);
                return response.data.data;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async tasksList(token, accountIndex, retries = 5) {
        try {
            const response = await this.createAxiosInstance(token, accountIndex).get('/tasks');
            return response.data.data;
        } catch (error) {
            this.log(chalk.red(`HTTP ERROR: ${error.message}`));
            return null;
        }
    }

    async startTask(token, accountIndex, taskId, retries = 5) {
        try {
            const response = await this.createAxiosInstance(token, accountIndex).post('/tasks/taskRun', {
                taskIdx: taskId
            });
            return response.data.data;
        } catch (error) {
            this.log(chalk.red(`HTTP ERROR: ${error.message}`));
            return null;
        }
    }

    async claimTask(token, accountIndex, taskId, retries = 5) {
        try {
            const response = await this.createAxiosInstance(token, accountIndex).post('/tasks/taskComplete', {
                taskIdx: taskId
            });
            return response.data.data;
        } catch (error) {
            this.log(chalk.red(`HTTP ERROR: ${error.message}`));
            return null;
        }
    }

    async gameStatus(token, accountIndex, gameId, retries = 5) {
        const url = `/games/status?gameCode=${gameId}`;
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.get(url);
                return response.data.data;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async gameRun(token, accountIndex, gameId, level, retries = 5) {
        const url = '/games/gameRun';
        const data = {
            gameId: gameId,
            level: level,
            logStatus: 'S'
        };
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.post(url, data);
                if (response.data && response.data.success) {
                    return response.data.data;
                }
                return null;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async gameComplete(token, accountIndex, gameId, level, runIdx, retries = 5) {
        const url = '/games/gameComplete';
        const data = {
            gameId: gameId,
            level: level,
            runIdx: runIdx.toString(),
            logStatus: 'C'
        };
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const instance = this.createAxiosInstance(token, accountIndex);
                const response = await instance.post(url, data);
                if (response.data && response.data.success) {
                    return response.data.data;
                }
                return null;
            } catch (error) {
                if (attempt < retries - 1) {
                    this.log(chalk.red(`HTTP ERROR: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return null;
    }

    async processAccount(account, index) {
        this.log(chalk.cyan(`Processing account: ${account.first_name}`));
        
        // Check points
        const points = await this.userPoints(account.token, index);
        if (points) {
            this.log(chalk.green(`Current points: ${points.point}`));
        }

        // Daily attendance
        const attendance = await this.userAttendance(account.token, index);
        if (attendance && !attendance.isAttend) {
            const claim = await this.claimAttendance(account.token, index);
            if (claim) {
                this.log(chalk.green(`Daily check-in success! Earned ${claim.point || 0} points`));
            }
        } else if (attendance && attendance.isAttend) {
            this.log(chalk.yellow('Already checked in today'));
        }

        // Process games
        await this.processGames(account.token, index);

        // Process tasks
        const tasks = await this.tasksList(account.token, index);
        if (tasks && Array.isArray(tasks)) {
            let completedTask = false;
            for (const task of tasks) {
                const taskId = task.taskIdx;
                const status = task.runStatus;
                const completed = task.completeCount;

                if (task && status === null) {
                    const start = await this.startTask(account.token, index, taskId);
                    if (start) {
                        this.log(chalk.green(`Starting task: ${task.taskMainTitle}`));
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const claim = await this.claimTask(account.token, index, taskId);
                        if (claim) {
                            this.log(chalk.green(`Task completed: ${task.taskMainTitle}, earned ${claim.point || 0} points, ${claim.egg || 0} eggs`));
                        } else {
                            this.log(chalk.red(`Failed to complete task: ${task.taskMainTitle}`));
                        }
                    } else {
                        this.log(chalk.red(`Failed to start task: ${task.taskMainTitle}`));
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else if (task && status === 'S' && completed === 0) {
                    const claim = await this.claimTask(account.token, index, taskId);
                    if (claim) {
                        this.log(chalk.green(`Task completed: ${task.taskMainTitle}, earned ${claim.point || 0} points, ${claim.egg || 0} eggs`));
                    } else {
                        this.log(chalk.red(`Failed to complete task: ${task.taskMainTitle}`));
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    completedTask = true;
                }
            }

            if (completedTask) {
                this.log(chalk.green('All tasks completed'));
            }
        } else {
            this.log(chalk.yellow('No available tasks'));
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async processGames(token, accountIndex) {
        const games = ['MZJM', 'MZCS', 'MZBY'];
        
        for (const gameId of games) {
            this.log(chalk.cyan(`Processing game: ${gameId}`));
            const status = await this.gameStatus(token, accountIndex, gameId);
            
            if (status && status.levels) {
                let allLevelsCompleted = true;
                
                for (const level of Object.keys(status.levels)) {
                    const levelStatus = status.levels[level];
                    if (!levelStatus.isComplete) {
                        allLevelsCompleted = false;
                        const run = await this.gameRun(token, accountIndex, gameId, level);
                        
                        if (run) {
                            this.log(chalk.green(`Started game ${gameId} level ${level}`));
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            const complete = await this.gameComplete(token, accountIndex, gameId, level, run.runIdx);
                            if (complete) {
                                this.log(chalk.green(`Completed game ${gameId} level ${level}`));
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
                if (allLevelsCompleted) {
                    this.log(chalk.yellow(`Game ${gameId} all levels completed`));
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async main() {
        await this.loadProxies();
        const queries = await this.loadQueries();
        
        if (queries.length === 0) {
            this.log(chalk.red('No account information found'));
            return;
        }

        let tokens = await this.loadTokens();
        
        // Generate token
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const accountData = this.loadData(query);
            const accountName = accountData.first_name;

            const existingAccount = tokens.find(acc => acc.first_name === accountName);
            
            if (!existingAccount) {
                this.log(chalk.yellow(`Generating token for account ${accountName}...`));
                const token = await this.userLogin(query);
                
                if (token) {
                    tokens.push({ first_name: accountName, token });
                    await this.saveTokens(tokens);
                    this.log(chalk.green(`Successfully generated token for ${accountName}`));
                } else {
                    this.log(chalk.red(`Failed to generate token for ${accountName}`));
                }
            }
        }

        // Process each account
        for (let i = 0; i < tokens.length; i++) {
            await this.processAccount(tokens[i], i);
        }
    }
}

// Start the bot
const bot = new MoneyToon();
bot.main().catch(console.error);
