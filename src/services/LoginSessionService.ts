import DBService from './DBService';
import LoginSession, {ILoginSession} from '../models/user/login_session';

class LoginSessionService extends DBService<ILoginSession> {

    constructor() {
        const populatedFields:string[] = [];
        super(LoginSession, populatedFields);
    }
}

export default LoginSessionService;
