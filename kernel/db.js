const mysql = require('mysql');
const params = require('../params.js');

class Db {
    createConnection(login, password) {
        return mysql.createConnection({
            host: params.host,
            user: login,
            password: password,
            port: params.port,
            debug: false
        });
    }

    async select(con, sql) {

        [ rows, fields ] = await con.query(sql);

        console.debug(rows);
        return [];
    }

    selectColumn(con, sql, columnName) {
        resultRows = this.select(con, sql);
        ret = [];

        for (let row of resultRows) {
            ret.push(row[columnName]);
        }

        return ret;
    }
}

exports.db = new Db();
