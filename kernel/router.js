class Router {
    constructor() {
        this.guestUrls = [];
        this.listGet = {};
        this.listPost = {};
    }

    get(url, controller, guestUrl) {
        this.listGet[url] = controller;
        if (guestUrl) {
            this.guestUrls.push(url);
        }
    }

    isGuestUrl(u) {
        return this.guestUrls.indexOf(u) >= 0;
    }

    dispatch(u) {
        // console.debug(this.listGet);
        if (u in this.listGet) {
            return this.listGet[u];
        }

        return null;
    }
}

exports.router = new Router();

