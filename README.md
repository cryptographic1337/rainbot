# Rain Bot
## Table Of Contents
- [Config](#config)
- [Commands](#commands)
- [Setup](#setup)
- [License](#license)

## Config
`WEBSERVER`: Chat web server to connect to. This should be a full url, including https:// and excluding any path (/test). In the invalid syntax message, /faq will be added after this variable to direct users to the FAQ.

`SENTRY_DSN`: *Optional*. This is an optional Sentry DSN used for error reporting to sentry.io

`PREFIX`: Bot prefix

`SESSION`: ID Cookie the bot will use to sign in.

`DATABASE_URL`: Database URL. This database must be the same database that the main web server uses.

## Commands
`rain [users] [amount]`: Will rain [amount] bits on x[users] random users

`rainon [user] [amount]`: Will rain [amount] bits on [user]

`help`/`faq`: Will direct user to the FAQ Page

## Setup
1. Create a new `.env` file in the root folder, and fill in the parameters listed in `config.js` ([Reference](#config))
2. `npm install`
3. `npm start`

## License
This repository is licensed under GNU General Public License v3.0
