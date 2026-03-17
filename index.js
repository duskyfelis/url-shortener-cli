#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');
const clipboardy = require('clipboardy');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  version: '1.0.0',
  services: {
    tinyurl: {
      name: 'TinyURL',
      url: 'https://tinyurl.com/api-create.php',
      method: 'GET',
      param: 'url'
    },
    isgd: {
      name: 'is.gd',
      url: 'https://is.gd/create.php',
      method: 'GET',
      params: { format: 'simple' },
      param: 'url'
    },
    vgd: {
      name: 'v.gd',
      url: 'https://v.gd/create.php',
      method: 'GET',
      params: { format: 'simple' },
      param: 'url'
    },
    // Add Bitly if you have an API token
    // bitly: {
    //   name: 'Bitly',
    //   url: 'https://api-ssl.bitly.com/v4/shorten',
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${process.env.BITLY_TOKEN}` },
    //   body: { long_url: '{{url}}' }
    // }
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();
const url = args[1];
const service = args[2] || 'tinyurl';

// Help menu
const showHelp = () => {
  console.log(chalk.bold.cyan('\n🔗 URL Shortener CLI v' + config.version));
  console.log(chalk.gray('=' .repeat(50)));
  console.log(chalk.white('\nUsage:'));
  console.log(chalk.yellow('  shorten <url> [service]') + chalk.gray('   - Shorten a URL'));
  console.log(chalk.yellow('  shorten -s <url>') + chalk.gray('         - Shorten and copy to clipboard'));
  console.log(chalk.yellow('  shorten -l') + chalk.gray('               - List available services'));
  console.log(chalk.yellow('  shorten -h, --help') + chalk.gray('      - Show this help'));
  console.log(chalk.yellow('  shorten -v, --version') + chalk.gray('   - Show version'));
  
  console.log(chalk.white('\nExamples:'));
  console.log(chalk.gray('  shorten https://example.com/very/long/url'));
  console.log(chalk.gray('  shorten https://example.com tinyurl'));
  console.log(chalk.gray('  shorten -s https://example.com'));
  
  console.log(chalk.white('\nSupported services:'));
  console.log(chalk.gray('  tinyurl   - TinyURL (default)'));
  console.log(chalk.gray('  isgd      - is.gd'));
  console.log(chalk.gray('  vgd       - v.gd'));
  // console.log(chalk.gray('  bitly     - Bitly (requires API key)'));
  
  console.log(chalk.gray('=' .repeat(50)) + '\n');
};

// Show version
const showVersion = () => {
  console.log(chalk.cyan('URL Shortener CLI v' + config.version));
};

// List services
const listServices = () => {
  console.log(chalk.bold.cyan('\n📋 Available URL Shortening Services:'));
  console.log(chalk.gray('=' .repeat(40)));
  
  Object.entries(config.services).forEach(([key, service]) => {
    console.log(chalk.yellow(`  ${key.padEnd(10)}`) + chalk.white(`- ${service.name}`));
  });
  
  console.log(chalk.gray('=' .repeat(40)) + '\n');
};

// Validate URL
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Shorten URL function
async function shortenUrl(url, service = 'tinyurl', copyToClipboard = false) {
  const serviceConfig = config.services[service];
  
  if (!serviceConfig) {
    console.log(chalk.red(`❌ Service "${service}" not supported.`));
    console.log(chalk.yellow('Use "shorten -l" to see available services.'));
    return;
  }
  
  if (!isValidUrl(url)) {
    console.log(chalk.red('❌ Invalid URL. Please include http:// or https://'));
    return;
  }
  
  console.log(chalk.blue(`\n🔗 Shortening: ${chalk.white(url)}`));
  console.log(chalk.blue(`📡 Service: ${chalk.white(serviceConfig.name)}`));
  console.log(chalk.gray('⏳ Processing...'));
  
  try {
    let response;
    
    if (serviceConfig.method === 'GET') {
      // GET request (TinyURL, is.gd, v.gd)
      const params = new URLSearchParams({
        [serviceConfig.param]: url,
        ...serviceConfig.params
      });
      
      response = await axios.get(`${serviceConfig.url}?${params.toString()}`);
      shortUrl = response.data.trim();
      
    } else if (serviceConfig.method === 'POST') {
      // POST request (Bitly, etc.)
      const body = JSON.parse(JSON.stringify(serviceConfig.body).replace('{{url}}', url));
      
      response = await axios.post(serviceConfig.url, body, {
        headers: serviceConfig.headers || { 'Content-Type': 'application/json' }
      });
      
      // Handle different response formats
      shortUrl = response.data.link || response.data.id || response.data.short_url;
    }
    
    // Success output
    console.log(chalk.green('\n✅ Success!'));
    console.log(chalk.gray('─' .repeat(40)));
    console.log(chalk.white(`Original: ${chalk.gray(url)}`));
    console.log(chalk.white(`Shortened: ${chalk.cyan.bold(shortUrl)}`));
    
    // Copy to clipboard if requested
    if (copyToClipboard) {
      try {
        await clipboardy.write(shortUrl);
        console.log(chalk.green('📋 Copied to clipboard!'));
      } catch (err) {
        console.log(chalk.yellow('⚠️  Could not copy to clipboard'));
      }
    }
    
    // Save to history
    saveToHistory(url, shortUrl, service);
    
    console.log(chalk.gray('─' .repeat(40)) + '\n');
    
  } catch (error) {
    console.log(chalk.red('\n❌ Error:'));
    console.log(chalk.gray('─' .repeat(40)));
    
    if (error.response) {
      console.log(chalk.white(`Status: ${chalk.yellow(error.response.status)}`));
      console.log(chalk.white(`Message: ${chalk.yellow(error.response.data || 'Unknown error')}`));
    } else if (error.request) {
      console.log(chalk.white('No response from server. Check your internet connection.'));
    } else {
      console.log(chalk.white(error.message));
    }
    
    console.log(chalk.gray('─' .repeat(40)) + '\n');
  }
}

// Save to history
const HISTORY_FILE = path.join(__dirname, '.history.json');

function saveToHistory(original, shortened, service) {
  try {
    let history = [];
    
    // Read existing history
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    
    // Add new entry
    history.unshift({
      original,
      shortened,
      service,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 entries
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    
    // Save
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    // Silently fail - don't interrupt user experience
  }
}

// Show history
function showHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.log(chalk.yellow('No history yet.'));
    return;
  }
  
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    
    if (history.length === 0) {
      console.log(chalk.yellow('No history yet.'));
      return;
    }
    
    console.log(chalk.bold.cyan('\n📜 Recent Shortened URLs:'));
    console.log(chalk.gray('=' .repeat(50)));
    
    history.slice(0, 10).forEach((entry, i) => {
      const date = new Date(entry.timestamp).toLocaleString();
      console.log(chalk.white(`${i + 1}. ${chalk.cyan(entry.shortened)}`));
      console.log(chalk.gray(`   ↳ ${entry.original}`));
      console.log(chalk.gray(`   🏷️  ${entry.service}  •  ${date}`));
      console.log(chalk.gray('─' .repeat(40)));
    });
    
  } catch (err) {
    console.log(chalk.red('Error reading history.'));
  }
}

// Clear history
function clearHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
      console.log(chalk.green('✅ History cleared.'));
    } else {
      console.log(chalk.yellow('No history to clear.'));
    }
  } catch (err) {
    console.log(chalk.red('Error clearing history.'));
  }
}

// Main CLI logic
async function main() {
  // No arguments
  if (args.length === 0) {
    showHelp();
    return;
  }
  
  // Help
  if (command === '-h' || command === '--help' || command === 'help') {
    showHelp();
    return;
  }
  
  // Version
  if (command === '-v' || command === '--version' || command === 'version') {
    showVersion();
    return;
  }
  
  // List services
  if (command === '-l' || command === '--list' || command === 'list') {
    listServices();
    return;
  }
  
  // History
  if (command === '-history' || command === '--history' || command === 'history') {
    showHistory();
    return;
  }
  
  // Clear history
  if (command === '-clear' || command === '--clear' || command === 'clear') {
    clearHistory();
    return;
  }
  
  // Shorten with copy
  if (command === '-s' || command === '--copy') {
    const urlToShorten = args[1];
    const serviceToUse = args[2] || 'tinyurl';
    
    if (!urlToShorten) {
      console.log(chalk.red('❌ Please provide a URL to shorten.'));
      return;
    }
    
    await shortenUrl(urlToShorten, serviceToUse, true);
    return;
  }
  
  // Default: shorten URL
  if (command && !command.startsWith('-')) {
    await shortenUrl(command, args[1] || 'tinyurl', false);
    return;
  }
  
  // Unknown command
  console.log(chalk.red(`❌ Unknown command: ${command}`));
  console.log(chalk.yellow('Use "shorten --help" for usage information.'));
}

// Run
main().catch(console.error);
