class Response {
    constructor() {       
        this.content = "";
    }

    setRes(res) {
        this.res = res;
    }

    setCode(code) {
        this.res.statusCode = code;
    }

    setContent(content) {
        this.content = content;
    }

    finish() {
        this.res.end(this.content);
    }

    setContentType(contentType) {
        this.res.contentType = contentType;
    }
}

class RedirectResponse extends Response {
    setUrl(u) {
        this.redirectUrl = u;
    }

    finish() {
        this.setCode(302);
        this.res.setHeader('Location', this.redirectUrl);
        this.res.end();
    }
}

class TextResponse extends Response {
    setStatusCode(code) {
        this.res.statusCode = code;
    }

    finish() {
        this.setContentType('text/plain');
        super.finish();
    }
}

class HtmlResponse extends TextResponse {
    finish() {
        this.setContentType('text/html');
        super.finish();
    }
}

exports.response = new Response();
exports.textResponse = new TextResponse();
exports.htmlResponse = new HtmlResponse();
exports.redirectResponse = new RedirectResponse();

