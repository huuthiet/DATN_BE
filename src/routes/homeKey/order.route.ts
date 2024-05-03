import * as express from "express";

import AuthMiddleware from "../../middlewares/auth";

const orderRoute = express.Router();

// Login
orderRoute.use(AuthMiddleware.isAuthenticated);

/* ------------------------------ PRIVATE APIS ------------------------------ */

export default orderRoute;
