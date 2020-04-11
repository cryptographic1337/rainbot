var pg = require('pg');
var uuid = require('uuid');
var config = require('../config');

var databaseUrl = config.DATABASE_URL;

if (!databaseUrl)
    throw new Error('must set DATABASE_URL environment var');

console.log('DATABASE_URL: ', databaseUrl);

pg.types.setTypeParser(20, function (val) { // parse int8 as an integer
    return val === null ? null : parseInt(val);
});

function connect(callback) {
    return pg.connect(databaseUrl, callback);
}

function query(query, params, callback) {
    //third parameter is optional
    if (typeof params == 'function') {
        callback = params;
        params = [];
    }

    doIt();

    function doIt() {
        connect(function (err, client, done) {
            if (err) return callback(err);
            client.query(query, params, function (err, result) {
                done();
                if (err) {
                    if (err.code === '40P01') {
                        console.error('[INTERNAL] Warning: Retrying deadlocked transaction: ', query, params);
                        return doIt();
                    }
                    return callback(err);
                }

                callback(null, result);
            });
        });
    }
}


function getClient(runner, callback) {
    doIt();

    function doIt() {
        connect(function (err, client, done) {
            if (err) return callback(err);

            function rollback(err) {
                client.query('ROLLBACK', done);

                if (err.code === '40P01') {
                    console.error('[INTERNAL_ERROR] Warning: Retrying deadlocked transaction..');
                    return doIt();
                }

                callback(err);
            }

            client.query('BEGIN', function (err) {
                if (err)
                    return rollback(err);

                runner(client, function (err, data) {
                    if (err)
                        return rollback(err);

                    client.query('COMMIT', function (err) {
                        if (err)
                            return rollback(err);

                        done();
                        callback(null, data);
                    });
                });
            });
        });
    }
}

pg.on('error', function (err) {
    console.error('POSTGRES EMITTED AN ERROR', err);
});

exports.checkIfUserExists = function (username, callback) {
    query("SELECT COUNT(username) as count FROM users WHERE username = $1", [username], function (err, data) {
        if (err) return callback(err);
        return callback(null, data.rows[0].count !== 0);
    })
};

exports.getUserBalance = function (username, callback) {
    query("SELECT balance_satoshis FROM users WHERE username = $1", [username], function (err, data) {
        if (err) return callback(err);
        return callback(null, parseInt(data.rows[0].balance_satoshis) / 100);
    });
};

exports.doTransfer = function (fromUser, toUser, bits, callback) {
    const satoshis = parseInt(bits) * 100;

    getClient(function (client, callback) {
        client.query("SELECT id FROM users WHERE username = $1", [fromUser], function (err, data) {
            if (err) return callback(err);
            if (data.rowCount === 0) return callback('CANNOT_FIND_FROM_USER');
            var fromUserId = data.rows[0].id;

            client.query("SELECT id FROM users WHERE lower(username) = lower($1)", [toUser], function (err, data) {
                if (err) return callback(err);
                if (data.rowCount === 0) return callback('USER_NOT_EXIST');
                var toUserId = data.rows[0].id;

                client.query("UPDATE users SET balance_satoshis = balance_satoshis - $1 WHERE id = $2", [satoshis, fromUserId], function (err, data) {
                    if (err) {
                        if (err.code === '23514') return callback('NOT_ENOUGH_BALANCE');
                        return callback(err);
                    }

                    client.query("UPDATE users SET balance_satoshis = balance_satoshis + $1 WHERE id = $2", [satoshis, toUserId], function (err, data) {
                        if (err) return callback(err);
                        if (data.rowCount === 0) return callback('USER_NOT_EXIST');

                        client.query("INSERT INTO transfers (id, from_user_id, to_user_id, amount) values($1,$2,$3,$4)", [uuid.v4(), fromUserId, toUserId, satoshis], function (err) {
                            if (err) {
                                if (err.code === '23505') return callback('TRANSFER_ALREADY_MADE');
                                return callback(err);
                            }
                            callback();
                        });
                    });
                });
            });
        });
    }, callback);
};