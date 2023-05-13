import express from "express";
import cors from "./common/utils/Cors";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import helmet from "helmet";
import compression from "compression"
import AdminRoutes from "./routes/AdminRoutes";
import AppRoutes from "./routes/AppRoutes";
import AccountController from "./controllers/AccountController";
import AuthMiddleware from "./middlewares/AuthMiddleware";


export const apiVersion = process.env.API_VERSION || "v1";
export const API_PATH = `/api/${apiVersion}`;

class App {
    public app;

    constructor() {
      this.app = express();
      this.plugInRoutes();
      this.plugInMiddlewares();
    }

    private plugInMiddlewares() {
        this.app.use(cors());
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(express.json());
        // this.app.use(bodyParser.json());
        // this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));

    }
    private plugInRoutes() {
      const authMiddleware = new AuthMiddleware(this.app);
      const adminRoutes = new AdminRoutes(this.app);
      const appRoutes = new AppRoutes(this.app);

    
      this.app.use(API_PATH + "/account", AccountController);
      //load other public/non secured routes


      //Load Authentication MiddleWare
      this.app.use(authMiddleware.authGuard);

      adminRoutes.initRoutes();
      appRoutes.initRoutes();

    }
}

export default new App().app;