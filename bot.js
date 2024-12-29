const axios = require('axios');
const fs = require('fs').promises;
const chalk = require('chalk');
const moment = require('moment-timezone');

class MoneyToon {
    constructor() {
        this.proxies = [];
        this.currentProxyIndex = 0;
        this.headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-HK,zh-TW;q=0.9,zh;q=0.8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Content-Type': 'application/json',
            'Cookie': 'AWSALBCORS=hIsD6AmysgBOHSlBB2eihj+qIw8qMYGQHTt2QXUNo+KSx5rCU9kEGFLiRzMbKSpkpUfGg0Q7JTL79QBJ6pSsGMhoco5QAehkVrM68/B+iVZO3R+fZAuumtjqC04O',
            'Host': 'mt.promptale.io',
            'Origin': 'https://mt.promptale.io',
            'Pragma': 'no-cache',
            'Referer': 'https://mt.promptale.io/',
            'Sec-CH-UA': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        };
    }

    async loadProxies() {
        try {
            const data = await fs.readFile('proxies.txt', 'utf8');
            this.proxies = data.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
                
            if (this.proxies.length === 0) {
                this.log(chalk.yellow('No proxies found. Bot will run without proxies.'));
            } else {
                this.log(chalk.green(`Loaded ${this.proxies.length} proxies`));
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log(chalk.yellow('proxies.txt not found. Bot will run without proxies.'));
            } else {
                this.log(chalk.red(`Error loading proxies: ${error.message}`));
            }
            this.proxies = [];
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) {
            return null;
        }
        const proxy = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        return proxy;
    }

    createAxiosInstance(token, accountIndex) {
        const config = {
            baseURL: 'https://mt.promptale.io',
            headers: {
                ...this.headers,
                'Authorization': token ? `Bearer ${token}` : ''
            },
            timeout: 30000  // Increase timeout to 30 seconds
        };

        // Use proxy
        if (this.proxies.length > 0) {
            const proxy = this.getNextProxy();
            if (proxy) {
                try {
                    const [host, port] = proxy.split(':');
                    if (host && port) {
                        config.proxy = {
                            host: host,
                            port: parseInt(port),
                            protocol: 'http'  // Specify protocol
                        };
                        this.log(chalk.blue(`Using proxy: ${host}:${port}`));
                    }
                } catch (error) {
                    this.log(chalk.red(`Invalid proxy format: ${proxy}`));
                }
            }
        }

        const instance = axios.create(config);
        
        // Add response interceptor to handle errors
        instance.interceptors.response.use(
            response => response,
            error => {
                if (error.response) {
                    throw new Error(`HTTP ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
                } else if (error.request) {
                    throw new Error(error.message || 'Network error');
                } else {
                    throw error;
                }
            }
        );

        return instance;
    }

    log(message) {
        const timestamp = moment().tz('Asia/Jakarta').format('MM/DD/YY hh:mm:ss A z');
        console.log(`${chalk.cyan(`[ ${timestamp} ]`)} ${chalk.white('|')} ${message}`);
    }

    async loadQueries() {
        try {
            const data = await fs.readFile('query.txt', 'utf8');
            const queries = data.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            if (queries.length === 0) {
                this.log(chalk.yellow('No accounts found in query.txt'));
            } else {
                this.log(chalk.green(`Found ${queries.length} accounts in query.txt`));
            }
            return queries;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log(chalk.red('query.txt not found'));
            } else {
                this.log(chalk.red(`Error loading queries: ${error.message}`));
            }
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
                const instance = this.createAxiosInstance(null, attempt);
                const response = await instance.post(url, data);
                if (response.data && response.data.data && response.data.data.accessToken) {
                    this.log(chalk.green(`Successfully obtained token`));
                    return response.data.data.accessToken;
                }
                throw new Error('Invalid response format');
            } catch (error) {
                if (attempt < retries - 1) {
                    const proxy = this.getNextProxy(attempt);
                    if (proxy) {
                        this.log(chalk.yellow(`Retrying with proxy: ${proxy}`));
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    this.log(chalk.red(`Failed to login after ${retries} attempts`));
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

    async processAccount(account, accountIndex) {
        let currentProxyIndex = accountIndex;
        let retryCount = 0;
        const maxRetries = 3;  // Maximum 3 proxy retries

        while (retryCount < maxRetries) {
            try {
                // Create axios instance with current proxy
                const axiosInstance = this.createAxiosInstance(account.token, currentProxyIndex);
                
                // Attempt request
                await this.processAccountTasks(axiosInstance, account);
                break;  // If successful, exit retry loop
                
            } catch (error) {
                this.log(chalk.red(`Error with account ${account.first_name} using proxy ${currentProxyIndex + 1}: ${error.message}`));
                
                // If proxy error, try next proxy
                if (error.message.includes('ECONNREFUSED') || 
                    error.message.includes('socket disconnected') || 
                    error.message.includes('ETIMEDOUT')) {
                    
                    retryCount++;
                    // Cycle through available proxies
                    currentProxyIndex = (currentProxyIndex + 1) % this.proxies.length;
                    
                    if (retryCount < maxRetries) {
                        this.log(chalk.yellow(`Switching to proxy ${currentProxyIndex + 1} for account ${account.first_name}`));
                        await new Promise(resolve => setTimeout(resolve, 2000));  // Wait 2 seconds before retrying
                        continue;
                    }
                }
                
                // If max retries reached or not proxy error, log error and continue to next account
                this.log(chalk.red(`Failed to process account ${account.first_name} after ${retryCount} retries`));
                break;
            }
        }
    }

    async processAccountTasks(axiosInstance, account) {
        this.log(chalk.cyan(`Processing account: ${account.first_name}`));
        
        // Check points
        const points = await this.userPoints(account.token, 0);
        if (points) {
            this.log(chalk.green(`Current points: ${points.point}`));
        }

        // Daily attendance
        const attendance = await this.userAttendance(account.token, 0);
        if (attendance && !attendance.isAttend) {
            const claim = await this.claimAttendance(account.token, 0);
            if (claim) {
                this.log(chalk.green(`Daily check-in success! Earned ${claim.point || 0} points`));
            }
        } else if (attendance && attendance.isAttend) {
            this.log(chalk.yellow('Already checked in today'));
        }

        // Process games
        await this.processGames(account.token, 0);

        // Process tasks
        const tasks = await this.tasksList(account.token, 0);
        if (tasks && Array.isArray(tasks)) {
            let completedTask = false;
            for (const task of tasks) {
                const taskId = task.taskIdx;
                const status = task.runStatus;
                const completed = task.completeCount;

                if (task && status === null) {
                    const start = await this.startTask(account.token, 0, taskId);
                    if (start) {
                        this.log(chalk.green(`Starting task: ${task.taskMainTitle}`));
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const claim = await this.claimTask(account.token, 0, taskId);
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
                    const claim = await this.claimTask(account.token, 0, taskId);
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
        this.log(chalk.green('Bot started in continuous mode'));
        await this.loadProxies();
        const queries = await this.loadQueries();
        
        if (queries.length === 0) {
            this.log(chalk.red('No account information found'));
            return;
        }
        
        let tokens = await this.loadTokens();
        let runCount = 0;
        
        // Generate token for accounts that don't have one
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const accountData = this.loadData(query);
            const accountName = accountData.first_name;
            const existingToken = tokens.find(t => t.first_name === accountName);
            
            if (!existingToken) {
                this.log(chalk.yellow(`Generating token for account ${accountName}...`));
                const token = await this.userLogin(query);
                
                if (token) {
                    tokens.push({
                        first_name: accountName,
                        token: token
                    });
                    await this.saveTokens(tokens);
                    this.log(chalk.green(`Successfully generated token for ${accountName}`));
                } else {
                    this.log(chalk.red(`Failed to generate token for ${accountName}`));
                }
            }
        }
        
        while (true) {
            try {
                runCount++;
                this.log(chalk.cyan(`Starting run #${runCount}`));
                
                // Process each account sequentially
                for (const query of queries) {
                    try {
                        const accountData = this.loadData(query);
                        const accountName = accountData.first_name;
                        const accountToken = tokens.find(t => t.first_name === accountName);
                        
                        if (!accountToken) {
                            this.log(chalk.red(`No token found for account ${accountName}`));
                            continue;
                        }

                        // Get account index for proxy assignment
                        const accountIndex = queries.indexOf(query);
                        await this.processAccount({
                            first_name: accountName,
                            token: accountToken.token
                        }, accountIndex);
                        
                    } catch (error) {
                        if (error.message.includes('Authentication failed')) {
                            // If authentication fails, regenerate token
                            const accountData = this.loadData(query);
                            const accountName = accountData.first_name;
                            this.log(chalk.yellow(`Token expired for ${accountName}, regenerating...`));
                            
                            const newToken = await this.userLogin(query);
                            if (newToken) {
                                // Update token in tokens array
                                const index = tokens.findIndex(t => t.first_name === accountName);
                                if (index !== -1) {
                                    tokens[index].token = newToken;
                                } else {
                                    tokens.push({
                                        first_name: accountName,
                                        token: newToken
                                    });
                                }
                                await this.saveTokens(tokens);
                                this.log(chalk.green(`Successfully regenerated token for ${accountName}`));
                                
                                // Retry with new token
                                await this.processAccount({
                                    first_name: accountName,
                                    token: newToken
                                }, queries.indexOf(query));
                            }
                        } else {
                            this.log(chalk.red(`Error processing account: ${error.message}`));
                        }
                        continue;
                    }
                    
                    // Wait 5 seconds between accounts
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
                // Calculate next run time
                const now = new Date();
                const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
                
                this.log(chalk.blue('-----------------------------------'));
                this.log(chalk.green('✓ All tasks completed successfully'));
                this.log(chalk.yellow(`Next run scheduled at: ${nextRun.toLocaleTimeString()}`));
                this.log(chalk.blue('-----------------------------------'));
                
                // Wait 1 hour before next run
                await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
                
            } catch (error) {
                this.log(chalk.red(`Error in main loop: ${error.message}`));
                this.log(chalk.yellow('Retrying in 5 minutes...'));
                await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
            }
        }
    }
}

// Start the bot
const bot = new MoneyToon();
bot.main().catch(console.error);
