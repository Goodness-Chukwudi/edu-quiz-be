import UserService from "../services/UserService";
import RequestService from "../services/RequestService";
import ResponseMessage from "../messages/ResponseMessage";
import BaseResponseHandler from "../controllers/BaseResponseHandler";
import { Router } from "express";

abstract class BaseRouterMiddleware extends BaseResponseHandler {

    public router;
    protected userService: UserService;
    protected requestService: RequestService;
    protected responseMessage: ResponseMessage;


    constructor(appRouter:Router) {
        super();
        this.responseMessage = new ResponseMessage();
        this.router = appRouter;
        this.userService = new UserService();
        this.requestService = new RequestService(this.router);
        this.initServices();
    }

    protected abstract initServices():void;

    public validateAppInRequest = (req, res, next) => {
        const app = this.requestService.getApplication();
        if (!req.body.app_id && app._id) {
            return this.logAndSendErrorResponseObject(res, {message: "invalid App request. No App id"}, this.responseMessage.INVALID_REQUEST, 404);
        } else {
            next();
        }
    }

    public validateOrgInRequest = (req, res, next) => {
        if (req.body.ignore_organisation) {
            return next();
        }
        const organisation = this.requestService.getOrganisation();
        if (organisation && organisation._id) {
            req.body.organisation = organisation._id;
            return next();
        }
        if (!req.body.organisation) {
            return this.logAndSendErrorResponseObject(res, {message: "invalid organisation request"}, this.responseMessage.INVALID_REQUEST, 404);
        } else {
            next();
        }
    }

    public validateStoreInRequest = (req, res, next) => {
        if (!req.body.store) {
            return this.logAndSendErrorResponseObject(res, {message: "invalid store request. No store id"}, this.responseMessage.INVALID_REQUEST, 404);
        } else {
            next();
        }
    }

    protected logError(err) {
        this.logger.error(err);
    }

    protected getLoggedInStore() {
        return this.requestService.getLoggedInStore();
    }

    protected getOrganisationId() {
        const organisation = this.requestService.getOrganisation();
        return organisation?._id || '0'
    }

    protected getOrganisationType() {
        const organisation = this.requestService.getOrganisation();
        return organisation?.type;
    }

    protected getOrganisation() {
        return this.requestService.getOrganisation();
    }

    protected getApplicationType() {
        return this.requestService.getApplicationType();
    }
}

export default BaseRouterMiddleware;
