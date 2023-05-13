import { Request, Router, Response } from "express";

class RequestService {

    private router: Router;
    private request: Request;
    private response: Response;

    constructor(router: Router) {
        this.router = router;
        this.router.use((req, res, next) => {
            this.request = req;
            this.response = res;
            next();
        })
    }

    addToDataBag(key: string, value: any) {
        this.response.locals[key] = value;
    }

    getFromDataBag(key: string) {
        return this.response.locals[key];
    }

    getUser() {
        return this.response.locals.user;
    }

    getLoginSession() {
        return this.response.locals.login_session;
    }
}

export default RequestService;
