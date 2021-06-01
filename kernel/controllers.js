const fs = require('fs');
const urlr = require('url');
const mustache = require('mustache');
const { parse } = require('querystring');
const querystring = require('querystring');

const params = require('../params.js');
const response = require('./response.js');
const db = require('./db.js');

class Controller {
    constructor() {
        this.response = response.response;
    }

    init(req, res) {
        let url = req.url.substring(1);
        let qPos = url.indexOf('?');

        if (qPos >= 0) {
            url = url.substring(0, qPos);
        }

        this.query = urlr.parse(req.url, true).query;
        this.departs = url.trim("/").split("/");

        this.queryPairs = [];
        
        for (let p in this.query) {
            this.queryPairs.push(querystring.escape(p) + '=' + querystring.escape(this.query[p]));
        }

        this.queryStr = this.queryPairs.join("&");
    }

    build(req, res) {}

    run(req, res) {
        this.response.setContent(this.build(req, res));
        this.response.setRes(res);
        this.response.finish();
    }

    getConnectionUser(req) {
        let dbLogin = req.session.get('login', '');
        let dbPass = req.session.get('password', '');
        return db.db.createConnection(dbLogin, dbPass);
    }

    getConnectionRoot() {
        return db.db.createConnection(params.rootUser, params.rootPassword);
    }
}

class PostController extends Controller {
    run(req, res) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            this.post = parse(body);
            this.runPost(req, res);
        });
    }

    runPost() {}
}

class RedirectController extends Controller {
    constructor() {
        super();
        this.response = response.redirectResponse;
        this.url = "";
    }

    run(req, res) {
        this.response.finish();
    }
}

class HtmlController extends Controller {
    constructor() {
        super();
        this.response = response.htmlResponse;
    }
}

class HtmlTemplateController extends HtmlController {
    constructor() {
        super();
        this.response = response.htmlResponse;
        this.vars = {};
        this.layout = "";
        this.template = "";
        this.content = "";
    }

    setVar(name, value) {
        this.vars[name] = value;
    }

    setLayout(layout) {
        this.layout = layout;
    }

    setTemplate(template) {
        this.template = template;
    }

    prepare(req, res) {}

    run(req, res) {
        this.prepare(req, res);
        let resp = this.response;
        let c = this;

        fs.readFile(this.template, function(err, template) {
            res.setHeader('Cache-Controll', 'no-store, no-cache, must-revalidate');
            res.setHeader('Expires', 'Tue, 15 Nov 1994 05:05:23 GMT ');
            res.setHeader('Pragma', 'no-cache');

            let content = mustache.render("" + template, c.vars);

            if (c.layout) {
                c.setVar('content', content);

                fs.readFile(c.layout, function(err, layout) {
                    let page = mustache.render("" + layout, c.vars);
                
                    c.response.setContent(page);
                    c.response.setRes(res);
                    c.response.finish();
                });    
            } else {
                c.response.setContent(content);
                c.response.setRes(res);
                c.response.finish();
            }
        }); 

    }
}

class IndexController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        // let conRoot = this.getConnectionRoot();
        let badLogin = false;

        if (con) {
            con.connect((err) => {
                if (err && err.errno == 1045) {
                    req.session.put('error', 'Неверная пара логин/пароль');
                    req.session.put('login', '');
                    req.session.put('password', '');
                    this.response = response.redirectResponse;
                    this.response.setRes(res);
                    this.response.setUrl("/login");
                    this.response.finish();    
                } else if (err) {
                    throw err;
                } else {
                    let canCreateDatabase = false;

                    con.query("SHOW DATABASES", (err, result) => {
                        if (err) { throw err; }
                        this.setVar('login', req.session.get("login"));
                        this.setVar("title", "testing layout...");
                        this.setVar("database_list", result);
                        this.setVar("canCreateDatabase", true);
                        this.setTemplate("./pages/index.html");
                        this.setLayout("./pages/layout.html");
                
                        super.run(req, res);
                    });
                }
            });

            return;
        } else {
            res.end("No connection");
        }        
    }
}

class LoginController extends HtmlTemplateController {
    prepare(req, res) {
        this.setVar("error", req.session.get("error", ""));
        req.session.put("error", "");
        this.setTemplate("./pages/login.html");
        this.setLayout("./pages/layout.html");
    }
}

class AuthController extends PostController {
    runPost(req, res) {
        req.session.put('login', this.post.login);
        req.session.put('password', this.post.password);
        
        this.response = response.redirectResponse;
        this.response.setRes(res);
        this.response.setUrl("/");
        this.response.finish();
        res.end();
    }
}

class LogoutController extends HtmlTemplateController {
    run(req, res) {
        req.session.put('error', '');
        req.session.put('login', '');
        req.session.put('password', '');
        res.statusCode = 302;
        res.setHeader('Location',"/login");
        res.end();
    }
}

class DatabaseController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 1) {
            const databaseName = this.departs[1];

            con.query("SHOW TABLES FROM " + databaseName, (err, result) => {
                if (err) {
                    throw err;
                }

                let fieldName = "Tables_in_" + databaseName;
                let tableList = [];

                for (let r of result) {
                    tableList.push({ name: r[fieldName] });
                }

                this.setVar("tableList", tableList);
                this.setVar("database", databaseName);
                this.setTemplate("./pages/database.html");
                this.setLayout("./pages/layout.html");
                
                super.run(req, res);
            });
        } else {
            res.end("No database name given");    
        }

        con.end();
    }
}
class DatabaseCreateController extends PostController {
    runPost(req,res) {
        let con = this.getConnectionUser(req);
        let name = 'name';
        const sql = "CREATE database " + this.post.name;
        console.debug(this.post);
        con.query(sql, (err, result) => {
            if (err) { throw err; }
            this.response = response.redirectResponse;
            this.response.setRes(res);
            this.response.setUrl("/");
            this.response.finish();
        });
    }
}


class DatabaseDeleteController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 1) {
            const databaseName = this.departs[1];
            
            this.setVar("database", databaseName);

            this.setTemplate("./pages/database_delete.html");
            this.setLayout("./pages/layout.html");

            super.run(req, res);
        } else {
            res.end("No database name given");
        }
    }
}

class DatabaseDeleteConfirmedController extends PostController { 
    runPost(req,res) {
        let con = this.getConnectionUser(req);
        const sql = "DROP database " + this.departs[1];
        console.debug(this.post);
        con.query(sql, (err, result) => {
            if (err) { throw err; }
            this.response = response.redirectResponse;
            this.response.setRes(res);
            this.response.setUrl("/");
            this.response.finish();
        });
    }
}




class TableController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            const desql = "DESCRIBE " + databaseName + '.' + tableName;
            const sql = "SELECT * FROM " + databaseName + '.' + tableName + ' limit 100';

            let key_list = [];

            con.query(desql, (err2, result2) => {
                if (err2) { throw err2; }

                for (let f = 0; f < result2.length; f++) {
                    let item = result2[f];
                    if (item.Key == 'PRI') {
                        key_list.push(item.Field);
                    }
                }

                con.query(sql, (err, result, fields) => {
                    if (err) { throw err; }
                    let row_list = [];

                    for (let r of result) {
                        let cell_list = [];
                        let actions = '';
                        let keyString = '';
                        let keyArray = [];

                        for (let k of key_list) {
                            keyArray.push(querystring.escape(k) + '=' + querystring.escape(r[k]));
                        }
                        
                        keyString = keyArray.join('&');
                        actions += '<a href="/database-table-edit/' + databaseName + '/' + tableName + '/?' + keyString + '">Редактировать</a>';
                        actions += '&nbsp;&nbsp;';
                        actions += '<a href="/database-table-delete/' + databaseName + '/' + tableName + '/?' + keyString + '">Удалить</a>';
                        cell_list.push("<th>" + actions + "</th>" );
                        
                        for (let f of fields) {
                            cell_list.push( '<td>'+r[f.name]+'</td>');
                        }
                        row_list.push({data: cell_list.join("")});
                    }

                    this.setVar("table", tableName);
                    this.setVar("database", databaseName);
                    this.setVar("row_list", row_list);
                    this.setVar("field_list", fields);
                    this.setVar("key_list", key_list);
                    this.setTemplate("./pages/table.html");
                    this.setLayout("./pages/layout.html");
                    
                    super.run(req, res);
                });
            });
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowInsertController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];

            const sqlDescribe = 'DESCRIBE ' + databaseName + '.' + tableName;
            con.query(sqlDescribe, (err, result) => {
                if (err) { throw err; }
                let row_list = [];
                for (let r of result) {
                    // console.debug(r);
                    row_list.push(r);
                } 

                this.setVar('database', databaseName);
                this.setVar('table', tableName);
                this.setVar('row_list', row_list);

                this.setTemplate("./pages/insert.html");
                this.setLayout("./pages/layout.html");
                
                super.run(req, res);
            });
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowEditController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            let key_list = [];

            for (let key in this.query) {
                key_list.push(key + '=' + this.query[key]);
            }

            const sqlDescribe = 'DESCRIBE ' + databaseName + '.' + tableName;
            con.query(sqlDescribe, (err, result) => {
                if (err) { throw err; }
                /*let field_list = [];

                for (let r of result) {
                    // console.debug(r);
                    field_list.push(r);
                } */

                const sql = 'SELECT * FROM ' + databaseName + '.' + tableName + ' WHERE ' + key_list.join(' AND ') + ' LIMIT 1';
                
                con.query(sql, (err, result, fields) => {
                    if (err) { throw err; }
                    let row_list = [];
                    let row = result.pop();
                    let data = [];

                    for (let r of fields) {
                        r['Value'] = row[r['Field']];
                        console.debug(r);
                        data.push({'name' : r['name'], 'Value' : row[r['name']]})
                    } 

                    this.setVar('database', databaseName);
                    this.setVar('table', tableName);
                    this.setVar('key_list', key_list);
                    this.setVar('data', data);
                    this.setVar('query', this.queryStr);

                    this.setTemplate("./pages/edit.html");
                    this.setLayout("./pages/layout.html");
                    
                    super.run(req, res);
                });
            });
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowEditActionController extends PostController {
    runPost(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];

            let fields = [];
            let data = [];

            for(let f in this.post) {
                fields.push(f);
                data.push(f + '="' + this.post[f] + '"');
            }
            
            let keyList = [];

            for (let key in this.query) {
                keyList.push(key + '=' + this.query[key]);
            }

            let sql = 'UPDATE ' + databaseName + '.' + tableName + ' SET ' +  data.join(', ') + ' WHERE ' + keyList.join(' AND ') + ' LIMIT 1';

            con.query(sql, [ data ], function (err, result) {
                if (err) { throw err; }
            });

            this.response = response.redirectResponse;
            this.response.setRes(res);
            this.response.setUrl("/database-table/" + databaseName + '/' + tableName);
            this.response.finish();    
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowInsertActionController extends PostController {
    runPost(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];

            let fields = [];
            let data = [];
            for(let f in this.post) {
                fields.push(f);
                data.push(this.post[f]);
            }
            let sql = 'INSERT INTO ' + databaseName + '.' + tableName + ' (' + fields.join(',') + ') values ("' + data.join('","') + '")';

            con.query(sql, [ data ], function (err, result) {
                if (err) { throw err; }
            });

            this.response = response.redirectResponse;
            this.response.setRes(res);
            this.response.setUrl("/database-table/" + databaseName + '/' + tableName);
            this.response.finish();    
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowDeleteController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            
            let keyList = [];

            for (let key in this.query) {
                keyList.push(key + '=' + this.query[key]);
            }

            this.setVar("database", databaseName);
            this.setVar("table", tableName);
            this.setVar("query", this.queryStr);
            this.setVar("keyList", keyList);

            this.setTemplate("./pages/delete.html");
            this.setLayout("./pages/layout.html");

            super.run(req, res);
        } else {
            res.end("No database name or table name given");
        }
    }
}

class RowDeleteConfirmedController extends RedirectController {
    run(req, res) {
        let con = this.getConnectionUser(req);

        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            
            let keyList = [];

            for (let key in this.query) {
                keyList.push(key + '=' + this.query[key]);
            }

            const sql = 'DELETE FROM ' + databaseName + '.' + tableName + ' WHERE ' + keyList.join(' AND ') + ' LIMIT 1';
            
            con.query(sql, function(err, result) {
                if (err) { throw err; }
            });

            this.response = response.redirectResponse;
            this.response.setRes(res);
            this.response.setUrl("/database-table/" + databaseName + '/' + tableName);
            this.response.finish();    
        } else {
            res.end("No database name or table name given");
        }
    }
}

class QueryController extends HtmlTemplateController {
    prepare(req, res) {
        const databaseName = this.departs[1];

        this.setVar("database", databaseName);
        this.setVar("showCnt", false);
        this.setTemplate("./pages/query.html");
        this.setLayout("./pages/layout.html");
    }
}

class QueryActionController extends HtmlTemplateController {
    run(req, res) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            this.post = parse(body);
            this.runPost(req, res);
        });
    }

    runPost(req, res) {
        const databaseName = this.departs[1];
        let errorMessage = '';
        let con = this.getConnectionUser(req);
        
        con.query('USE ' + databaseName, [], (err, result) => {
            if (err) { errorMessage = err; }

            let affectedRows = 0;
            let fields = [];
            /*let data = [];

            for(let f in this.post) {
                fields.push(f);
                data.push(f + '="' + this.post[f] + '"');
            }*/
            
            let sql = this.post['SQL'];
            let row_list = [];
            let field_list = [];
            con.query(sql, (err, result, fields) => {
                const sqlWords = sql.split(" ");
                const isSelect = [ 'SELECT', 'SHOW', 'DESC', 'DESCRIBE' ].indexOf(sqlWords[0].toUpperCase()) >= 0;
                let cnt = 0;
                if (err) { errorMessage = err.sqlMessage + ' [' + err.sql + ']'; }

                if(result && result.length && result.length > 0) {
                    for (let r of result) {
                        let cell_list = [];
                        let actions = '';

                        cell_list.push("<th>" + actions + "</th>" );
                        for (let f of fields) {
                            if(cnt == 0) {
                                field_list.push(f);
                            }
                            cell_list.push( '<td>'+r[f.name]+'</td>');
                        }
                        cnt++;
                        row_list.push({data: cell_list.join("")});
                    }
                }

                if (result && result instanceof Object && result.affectedRows > 0) {
                    affectedRows = result.affectedRows;
                }

                let context = {
                    errorMessage: errorMessage,
                    sql: sql,
                    affectedRows: affectedRows,
                    cnt: cnt
                };

                this.setVar("database", databaseName);
                this.setVar("row_list", row_list);
                this.setVar("field_list", field_list);
                this.setVar("sql", sql);
                this.setVar("cnt", cnt);
                this.setVar("showCnt", true);
                this.setVar("showAffected", !isSelect);
                this.setVar("errorMessage", errorMessage);
                this.setVar("affectedRows", affectedRows);
                this.setTemplate("./pages/dbquery_result.html");
                super.run(req, res);
                // this.setLayout("./pages/layout.html");
            });
        });
    }
}

class TableDeleteController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            
            this.setVar("database", databaseName);
            this.setVar("table", tableName);

            this.setTemplate("./pages/table_delete.html");
            this.setLayout("./pages/layout.html");

            super.run(req, res);
        } else {
            res.end("No database name or table name given");
        }
    }
}

class TableDeleteConfirmedController extends RedirectController {
    run(req, res) {
        let con = this.getConnectionUser(req);

        if (this.departs.length > 2) {
            const databaseName = this.departs[1];
            const tableName = this.departs[2];
            
            const sql = 'DROP TABLE ' + databaseName + '.' + tableName;
            
            con.query(sql, function(err, result) {
                if (err) { throw err; }
                this.response = response.redirectResponse;
                this.response.setRes(res);
                this.response.setUrl("/database/" + databaseName);
                this.response.finish();    
            });

          
        } else {
            res.end("No database name or table name given");
        }
    }
}

class SelectBuilderController extends HtmlTemplateController {
    run(req, res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 2) {
            const databaseName = this.departs[1];

            const tableName = this.departs[2];

            const sqlDescribe = 'DESCRIBE ' + databaseName + '.' + tableName;
            con.query(sqlDescribe, (err, result) => {
                if (err) { throw err; }
                let row_list = [];
                for (let r of result) {
                    // console.debug(r);
                    row_list.push(r);
                } 

                this.setVar('database', databaseName);
                this.setVar('table', tableName);
                this.setVar('row_list', row_list);
                this.setTemplate("./pages/select_builder.html");
                this.setLayout("./pages/layout.html");
                
                super.run(req, res);
            });
        } else {
            res.end("No database or table name given");    
        }
        con.end();
    }
}

class DatabaseImportController extends HtmlTemplateController {
    prepare(req, res) {
        const databaseName = this.departs.length > 0 ? this.departs[1] : '';

        this.setVar("database", databaseName);
        this.setVar("showCnt", false);
        this.setTemplate("./pages/import.html");
        this.setLayout("./pages/layout.html");
    }
}

class DatabaseImportDoController extends PostController {

}

class DatabaseExportController extends PostController { 
    runPost(req,res) {
        let con = this.getConnectionUser(req);
        if (this.departs.length > 1) {
            const databaseName = this.departs[1];

            con.query("SHOW TABLES FROM " + databaseName, (err, result) => {
                if (err) {
                    throw err;
                }

                let fieldName = "Tables_in_" + databaseName;
                let tableList = [];
                let content = '';
                let tableCount = result.length;
                let cnt = 0;

                for (let r of result) {
                    cnt++;
                    tableList.push({ name: r[fieldName] });
                    const sql = 'SHOW CREATE TABLE ' + r[fieldName];
                    con.query(sql, (err2, result2) => {
                        if (err2) {
                            throw err2;
                        }
                        for(let rr in result2){
                            content += rr['Create Table'];
                            if(cnt == tableCount) {
                                res.end('ok');
                                console.log(content);
                            }
                        }
                        con.end();
                    });
                    console.log(r[fieldName]);
                }
                super.run(req, res);
            });
        } else {
            res.end("No database name given");    
        }

        con.end();
    }
}



exports.indexController = new IndexController();
exports.loginController = new LoginController();
exports.authController = new AuthController();
exports.logoutController = new LogoutController();
exports.tableDeleteController = new TableDeleteController(); 
exports.tableDeleteConfirmedController = new TableDeleteConfirmedController(); 
exports.databaseController = new DatabaseController();
exports.tableController = new TableController();
exports.rowInsertController = new RowInsertController();
exports.rowInsertActionController = new RowInsertActionController();
exports.rowEditController = new RowEditController();
exports.rowEditActionController = new RowEditActionController();
exports.rowDeleteController = new RowDeleteController();
exports.rowDeleteConfirmedController = new RowDeleteConfirmedController();
exports.queryController = new QueryController();
exports.queryActionController = new QueryActionController();
exports.databaseCreateController = new DatabaseCreateController();
exports.databaseDeleteController = new DatabaseDeleteController();
exports.databaseDeleteConfimedController = new DatabaseDeleteConfirmedController();
exports.selectBuilderController = new SelectBuilderController();
exports.databaseImportController = new DatabaseImportController();
exports.databaseExportController = new DatabaseExportController();