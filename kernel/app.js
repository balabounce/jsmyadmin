const fs = require('fs');
const http = require('http');
const NodeSession = require('node-session');

class Engine {
    constructor() {
        this.host = "127.0.0.1";
        this.port = 3000;
    }

    setHost(host) {
        this.host = host;
    }

    setPort(port) {
        this.port = port; 
    }

    run(router) {
        let session = new NodeSession({secret: 'qwertyuiopasdfghjklzxcvbnm[;.]'});

        const server = http.createServer((req, res) => {
            let url = req.url.substring(1);
            let qPos = url.indexOf('?');
            let queryStr = "";

            if (qPos >= 0) {
                queryStr = url.substring(qPos + 1);
                url = url.substring(0, qPos);
            }

            let departs = url.split("/");
            let depart = departs.length > 0 ? departs[0] : "";

            session.startSession(req, res, function() {
                let login = req.session.get('login', '');
                const pos = url.lastIndexOf(".");
                const ext = pos > 0 ? url.substr(pos + 1) : "";

                if ([ 'html', 'htm', 'css', 'js', 'jpg', 'jpeg', 'gif', 'png' ].indexOf(ext) >= 0) {
                    fs.readFile("./" + url, function(err, data) {
                        if (err) { 
                            console.log("Error with url: " + url + " -=- " + fs.realpath(url));
                            throw err; 
                        }
                        res.end(data);
                    });

                    return;
                }

                if (!login && !router.isGuestUrl(depart)) {
                    res.statusCode = 302;
                    res.setHeader('Location', "/login");
                    res.end();
                    return;
                }

                let controller = router.dispatch(depart);
                
                if (controller) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html');
                    controller.init(req, res);
                    controller.run(req, res);    
                } else {
                    res.statusCode = 404;
                    res.end("Page [" + depart + "] not found");    
                }
            });
        });

        server.listen(this.port, this.host, () => {
            console.log(`Server running at http://${this.host}:${this.port}/`);
        });
    }
}

exports.engine = new Engine();
