const _ = require('lodash');
const debug = require('debug')('rainbot');

const config = require('./config');
const database = require('./src/database');
const WebClient = require('./src/webclient');
const lib = require('./src/lib');

if (config.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: config.SENTRY_DSN });
}

// Command Regex
const cmdReg = new RegExp(`^\s*${config.PREFIX}([a-zA-z]*)\s*(.*)$`, 'i');

// Available Commands
var commands = ["rain", "rainon", "help", "faq"];

// Connect to web client
var client = new WebClient(config);

// User Store
var all_users = [];

client.on('join', function(data) {
    // Get last 100 messages
    var history = data.history.slice(1).slice(-125);

    // Delete RainBot msgs
    history = history.filter(el => el !== 'RainBot');

    // Convert JSON to array with usernames
    history.forEach(msg => {
        all_users.push(msg.username);
    });
});

client.on('msg', function(msg) {
    debug('Logging message into memory.');

    // Add user to user pool
    if (msg.username !== 'RainBot') all_users.push(msg.username);

    if (msg.message) {
        // Delete first message
        all_users.splice(0, 1);

        // Match command
        try {
            var cmdMatch = msg.message.match(cmdReg);
        } catch (e) {
            return debug("Match error: " + e);
        }

        if (cmdMatch) {
            const fromUser = msg.username;
            const channelName = msg.channelName;
            const command = _.trim(cmdMatch[1]);

	        // Check if command is a rainbot command
		if (commands.includes(command)) {
                debug('Command matched. Processing...');

                // If command is faq or help, send msg
                if (command === "faq" || command === "help") return client.doSay(`@${fromUser}, view help at ${config.WEBSERVER}/faq#rainbot`);

                // Check if arguments exists after command
                if (!cmdMatch[2]) return client.doSay(`@${fromUser}, invalid syntax. ${config.WEBSERVER}/faq#rainbot`, channelName);

                // Covert arguments to array
                const args = cmdMatch[2].split(' ');

                // Save args to variables
                const user = _.trim(args[0]);
                const bits = _.trim(args[1]);

                if (command === "rain") {
                    debug('Rain command called by ' + fromUser);

                    // Validate syntax
                    if (!lib.isNumber(user) || !lib.isNumber(bits)) return client.doSay(`@${fromUser}, view help at ${config.WEBSERVER}/faq#rainbot`, channelName);

                    // Get user balance
                    database.getUserBalance(fromUser, function(err, balance) {
                        if (err) {
                            console.error(err);
                            return client.doSay('@' + fromUser + ', something bad happened. Please try again.', channelName);
                        }

                        // Make sure user has enough bits
                        const total_bits = parseInt(user) * parseInt(bits);
                        if (total_bits > balance) return client.doSay('@' + fromUser + ', you don\'t have enough bits to do this.', channelName);

                        // Get random users from chat
                        var to_credit = [];
                        var index = 0;

                        // If amount of users in array is less than amount of users
                        let msg_count = lib.countUnique(all_users.filter(el => el !== fromUser && el !== 'RainBot'));
                        if (msg_count < parseInt(user)) return client.doSay('@' + fromUser + ', I haven\'t logged enough messages to rain on that many random users. You can rain on max ' + msg_count + ' users at this time.', channelName);

                        get_random();

                        function get_random() {
                            // Get random user from total users in chat
                            let random = all_users[Math.floor(Math.random() * all_users.length)];

                            if (!to_credit.includes(random) && random !== "RainBot" && random !== fromUser) { // Check if user has already been selected and not rainbot
                                to_credit.push(random);

                                if (index >= user - 1) {
                                    send();
                                } else {
                                    index++;
                                    setTimeout(get_random, 0);
                                }
                            } else {
                                setTimeout(get_random, 0);
                            }
                        }

                        var send_index = 0;

                        function send() { // Transfer all bits to users
                            database.doTransfer(fromUser, to_credit[send_index], bits, function(err) {
                                if (err) {
                                    if (err === 'NOT_ENOUGH_BALANCE') return client.doSay('@' + fromUser + ', you don\'t have enough balance.', channelName);
                                    if (err === 'USER_NOT_EXIST') return client.doSay('@' + fromUser + ', user does not exist.', channelName);

                                    console.error("[INTERNAL_ERROR] could not make transfer: ", err);
                                    return client.doSay('@' + fromUser + ', something bad happened. Please try again.', channelName);
                                }

                                if (send_index >= user - 1) {
                                    // Convert user array to comma separated string with @'s
                                    var users_with_at = to_credit.map(el => {
                                        return '@' + el;
                                    });

                                    // Send Rain
                                    debug('Sent rain to ' + users_with_at.join(', ') + ' from ' + fromUser);
                                    var plural = (bits > 1) ? 's' : '';
                                    return client.doSay('💧💧💧 @' + fromUser + ' has made it rain on ' + users_with_at.join(', ') + '! They have recieved ' + bits + ' bit' + plural + ' each! 💧💧💧', channelName);
                                } else {
                                    send_index++;
                                    setTimeout(send, 0);
                                }
                            })
                        }
                    })
                } else if (command === "rainon") {
                    if (!lib.isNumber(bits)) return client.doSay(`@${fromUser}, view help at ${config.WEBSERVER}/faq#rainbot`, channelName);
                    if (!lib.isValidUsername(user) !== false) return client.doSay('@' + fromUser + ', invalid username.', channelName);

                    database.checkIfUserExists(user, function(err, exists) {
                        if (err) {
                            console.error(err);
                            return client.doSay('@' + fromUser + ', something bad happened. Please try again.', channelName);
                        }

                        // Make sure to user exists
                        if (!exists) return client.doSay('@' + fromUser + ', user does not exist.', channelName);

                        // Get from user balance
                        database.getUserBalance(fromUser, function(err, balance) {
                            if (err) {
                                console.error(err);
                                return client.doSay('@' + fromUser + ', something bad happened. Please try again.', channelName);
                            }

                            // Make sure from user has enough bits
                            if (parseInt(bits) > balance) return client.doSay('@' + fromUser + ', you don\'t have enough bits to do this.', channelName);

                            // Transfer bits
                            database.doTransfer(fromUser, user, bits, function(err) {
                                if (err) {
                                    if (err === 'NOT_ENOUGH_BALANCE') return client.doSay('@' + fromUser + ', you don\'t have enough balance.', channelName);
                                    if (err === 'USER_NOT_EXIST') return client.doSay('@' + fromUser + ', user does not exist.', channelName);

                                    console.error("[INTERNAL_ERROR] could not make transfer: ", err);
                                    return client.doSay('@' + fromUser + ', something bad happened. Please try again.', channelName);
                                }

                                // Send rain
                                debug('Sent rain to ' + user + ' from ' + fromUser);
                                var plural = (bits > 1) ? 's' : '';
                                return client.doSay('💧💧💧 @' + fromUser + ' has made it rain on @' + user + '! They have received ' + bits + ' bit' + plural + '! 💧💧💧', channelName);
                            })
                        })
                    });
                }
            }
        }
    }
});
