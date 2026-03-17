# URL Shortener CLI

A command-line tool to shorten URLs using multiple services.

## Installation

```bash
git clone https://github.com/duskyfelis/url-shortener-cli.git
cd url-shortener-cli
npm install
npm link
```
OR

```bash
Usage:
  shorten <url> [service]          - Shorten a URL
  shorten -s <url>                  - Shorten and copy to clipboard
  shorten -l                         - List available services
  shorten -h, --help                 - Show this help
  shorten -v, --version              - Show version
  shorten --history                   - Show recent URLs
  shorten --clear                      - Clear history
```
```bash
Examples:
  shorten https://example.com/very/long/url
  shorten https://example.com tinyurl
  shorten -s https://example.com
