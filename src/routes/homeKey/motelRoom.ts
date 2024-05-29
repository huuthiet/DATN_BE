//Libs
import * as express from "express";

//Middleware
import AuthMiddleware from "../../middlewares/auth";

//Controller
import MotelRoomController from "../../controllers/homeKey/motelRoom";
import JobController from "../../controllers/homeKey/job.controller";

const motelRoomRoute = express.Router();

/* -------------------------------------------------------------------------- */
/*                         START MOTEL ROOM MIDDLEWARE                        */
/* -------------------------------------------------------------------------- */

/* ------------------------------- PUBLIC APIS ------------------------------ */

// Get list of motel room
motelRoomRoute.route("/list").get(MotelRoomController.getMotelRoomList);
motelRoomRoute.route("/getMotelByOwner/:id").get(MotelRoomController.getMotelRoomListByOwner);

// Get motel room detail
motelRoomRoute
  .route("/:id/roomdetail/:idroom")
  .get(MotelRoomController.getMotelRoomByIdDetail);
motelRoomRoute
  .route("/:id/room/:idroom/user/:idUser")
  .get(MotelRoomController.getMotelRoomByIdRoom);

motelRoomRoute.route("/:id").get(MotelRoomController.getMotelRoomById);

motelRoomRoute.route("/getMotelByIdV2/:id").get(MotelRoomController.getMotelRoomByIdV2);

// Post search Find MotelRoom from Address
motelRoomRoute
  .route("/search/:key")
  .get(MotelRoomController.postSearchMortelRoom);

/* ---------------------------- CHECK PERMISSION ---------------------------- */
motelRoomRoute.use(AuthMiddleware.isAuthenticated);
motelRoomRoute
  .route("/list/admin")
  .get(MotelRoomController.getMotelRoomListAdmin);
motelRoomRoute
  .route("/:id/jobList/MotelRoom")
  .get(JobController.getJobListByMotelId);

// Login

// Host
motelRoomRoute.route("/pdf").post(MotelRoomController.postExportPdf);
motelRoomRoute.route("/pdf/:id").post(MotelRoomController.postExportPdfById);
motelRoomRoute.use(AuthMiddleware.isHost);

/* ------------------------------ PRIVATE APIS ------------------------------ */

//Create motel room
motelRoomRoute.route("/").post(MotelRoomController.createMotelRoom);

// Edit motel room detail
motelRoomRoute
  .route("/:id")
  .put(MotelRoomController.editMotelRoomById)
  .delete(MotelRoomController.deleteMotelRoom);

motelRoomRoute.route("/jobList/all").get(JobController.getJobListAll);
motelRoomRoute
  .route("/owner/jobList/owner")
  .get(JobController.getJobListByOwner);
motelRoomRoute
  .route("/:id/jobList")
  .get(JobController.getJobListByOwnerAndMotelId);

motelRoomRoute
  .route("/img/:id")
  .post(MotelRoomController.postUploadImgByRoomId);

motelRoomRoute
  .route("/imgs/:id")
  .post(MotelRoomController.postUploadImgsByRoomId);

motelRoomRoute
  .route("/jobList/MotelRoom/owner")
  .get(JobController.getJobListByOwnerN);

/* -------------------------------------------------------------------------- */
/*                          END MOTEL ROOM MIDDLEWARE                         */
/* -------------------------------------------------------------------------- */

export default motelRoomRoute;
