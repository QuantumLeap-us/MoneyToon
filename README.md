# MoneyToon Bot 

A powerful bot for automating MoneyToon tasks with proxy support.

## Registration

Register for MoneyToon here: [MoneyToon Registration](https://t.me/moneytoon_bot/myApp?startapp=6D3A3E)

## Features

- Automatic daily check-in
- Game automation
- Task completion
- Proxy rotation support
- Secure token management
- Real-time status updates

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/QuantumLeap-us/MoneyToon.git
   cd MoneyToon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your account:**
   - Create `query.txt`
   - Add your query string

4. **Set up proxies (optional):**
   - Create `proxies.txt`
   - Add proxies in format: `ip:port:username:password`
   - Example: `127.0.0.1:8080:user:pass`

## Usage

Start the bot with:
```bash
npm start
```

The bot will automatically:
1. Load your configuration
2. Log in to your account
3. Perform daily check-in
4. Complete available tasks
5. Process games
6. Claim rewards

## Advanced Configuration

### Proxy Settings
- Add proxies to `proxies.txt`
- One proxy per line
- Format: `ip:port:username:password`
- The bot will automatically rotate through proxies

### Token Management
- Tokens are automatically managed
- Stored securely in `tokens.json`
- Auto-refreshed when expired

## Notes

- Keep your query string private
- Don't share your `tokens.json`
- Bot includes automatic rate limiting
- Check console for real-time status

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## License

This project is licensed under the MIT License

## Disclaimer

This bot is for educational purposes only. Use at your own risk.
