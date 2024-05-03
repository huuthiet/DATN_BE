import { NextFunction, Request, Response } from "express";
import * as lodash from "lodash";
import { helpers, jwtHelper, normalizeError } from "../../utils";
import ImageService from "../../services/image";
import HttpResponse from "../../services/response";

export default class OrderController {
  /**
   * @swagger
   * tags:
   *   - name: Order
   *     description: Order Control
   */

  /**
   * @swagger
   * /v1/admin/homeKey/order/list:
   *   get:
   *     description: Get order job
   *     tags: [Order]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: keyword
   *         in: query
   *         type:  string
   *         description: Keyword to find order
   *       - name: sortBy
   *         in: query
   *         type:  string
   *         description: Sort By
   *         enum:
   *              - createdAt
   *              - updatedAt
   *       - name: sortType
   *         in: query
   *         type:  string
   *         description: Sort Type
   *         enum:
   *              - ascending
   *              - descending
   *       - name: size
   *         in: query
   *         description: Number of order returned
   *         type:  integer
   *         default: 20
   *       - name: page
   *         in: query
   *         default: 0
   *         description: Current page
   *         type:  integer
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */

  static async getOrderListByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        order: OrderModel,
        user: UserModel,
        room: roomModel,
        floor: floorModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { size, page } = req.query;
      let condition;
      condition = [
        {
          $lookup: {
            from: "jobs",
            localField: "job",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];
      const data = [];
      const dataNone = [];
      const resData = await OrderModel.paginate(size, page, condition);
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }
      for (let i = 0; i < resData.data.length; i++) {
        let userData = await UserModel.findOne(
          {
            _id: resData.data[i].user._id,
          },
          { password: 0, token: 0 }
        )
          .lean()
          .exec();
        if (userData) {
          resData.data[i].userDetail = userData;
        }
        if (resData.data[i].job) {
          const DataRoom = await roomModel
            .findOne({ _id: resData.data[i].job.room })
            .lean()
            .exec();
          if (DataRoom) {
            resData.data[i].roomDetail = DataRoom;
          }
        }

        let floorData = await floorModel
          .findOne({ rooms: resData.data[i].job.room })
          .populate("rooms")
          .lean()
          .exec();
        if (floorData) {
          resData.data[i].floorDetail = floorData;
          let motelRoomData = await motelRoomModel
            .findOne({ floors: floorData._id })
            .populate("floors")
            .lean()
            .exec();
          if (motelRoomData) {
            resData.data[i].motelRoomDataDetail = motelRoomData;
          }
        }
        if (resData.data[i].paymentMethod !== "none") {
          data.push(resData.data[i]);
        } else {
          dataNone.push(resData.data[i]);
        }
      }
      const dataRes = {
        data: [],
        dataNone: [],
      };
      dataRes.data = data;
      dataRes.dataNone = dataNone;

      return HttpResponse.returnSuccessResponse(res, dataRes);
    } catch (e) {
      next(e);
    }
  }

  static async getOrderListByHost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        order: OrderModel,
        user: UserModel,
        floor: floorModel,
        room: roomModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { size, page } = req.query;
      let condition;
      condition = [
        {
          $lookup: {
            from: "jobs",
            localField: "job",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];
      const data = [];
      const dataNone = [];
      const resData = await OrderModel.paginate(size, page, condition);
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }
      console.log({ sizeOfOrder: resData.data.length });
      for (let i = 0; i < resData.data.length; i++) {
        let userData = await UserModel.findOne(
          {
            _id: resData.data[i].user._id,
          },
          { password: 0, token: 0 }
        )
          .lean()
          .exec();
        if (userData) {
          resData.data[i].userDetail = userData;
        }

        if (resData.data[i].job) {
          const DataRoom = await roomModel
            .findOne({ _id: resData.data[i].job.room })
            .lean()
            .exec();
          if (DataRoom) {
            resData.data[i].roomDetail = DataRoom;
          }
        }
        // console.log({ i });
        // if (i === 50) {
        //   console.log({ resDataItem: resData.data[49] });
        // }
        if (resData.data[i].job) {
          let floorData = await floorModel
            .findOne({ rooms: resData.data[i].job.room })
            .populate("rooms")
            .lean()
            .exec();
          if (floorData) {
            resData.data[i].floorDetail = floorData;
            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();
            if (motelRoomData) {
              resData.data[i].motelRoomDataDetail = motelRoomData;
            }
          }
        }
        if (resData.data[i].paymentMethod !== "none") {
          data.push(resData.data[i]);
        } else {
          dataNone.push(resData.data[i]);
        }
      }
      const dataRes = {
        data: [],
        dataNone: [],
      };
      console.log({ sizeOfData: data.length });
      const userData = req["userId"];
      if (data.length > 0) {
        for (let j = 0; j < data.length; j++) {
          if (data[j].motelRoomDataDetail) {
            if (data[j].motelRoomDataDetail.owner == userData.toString()) {
              dataRes.data.push(data[j]);
            }
          }
        }
      }
      console.log({ sizeOfDataNone: dataNone.length });
      if (dataNone.length > 0) {
        for (let k = 0; k < dataNone.length; k++) {
          if (
            dataNone[k] &&
            dataNone[k].motelRoomDataDetail &&
            dataNone[k].motelRoomDataDetail.owner &&
            dataNone[k].motelRoomDataDetail.owner == userData.toString()
          ) {
            dataRes.dataNone.push(dataNone[k]);
          }
        }
      }

      return HttpResponse.returnSuccessResponse(res, dataRes);
    } catch (e) {
      console.log({ e });
      next(e);
    }
  }

  static async getMonthlyOrderListByHost(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const {
        order: OrderModel,
        user: UserModel,
        floor: floorModel,
        room: roomModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      let { size, page } = req.query;
      let condition;
      condition = [
        {
          $lookup: {
            from: "jobs",
            localField: "job",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            isDeleted: 0,
            "user.password": 0,
            "user.token": 0,
            "user.isDeleted": 0,
            "user._v": 0,
          },
        },
      ];
      const data = [];
      const dataNone = [];
      const resData = await OrderModel.paginate(size, page, condition);
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }
      console.log({ sizeOfOrder: resData.data.length });
      for (let i = 0; i < resData.data.length; i++) {
        let userData = await UserModel.findOne(
          {
            _id: resData.data[i].user._id,
          },
          { password: 0, token: 0 }
        )
          .lean()
          .exec();
        if (userData) {
          resData.data[i].userDetail = userData;
        }

        if (resData.data[i].job) {
          const DataRoom = await roomModel
            .findOne({ _id: resData.data[i].job.room })
            .lean()
            .exec();
          if (DataRoom) {
            resData.data[i].roomDetail = DataRoom;
          }
        }
        if (resData.data[i].job) {
          let floorData = await floorModel
            .findOne({ rooms: resData.data[i].job.room })
            .populate("rooms")
            .lean()
            .exec();
          if (floorData) {
            resData.data[i].floorDetail = floorData;
            let motelRoomData = await motelRoomModel
              .findOne({ floors: floorData._id })
              .populate("floors")
              .lean()
              .exec();
            if (motelRoomData) {
              resData.data[i].motelRoomDataDetail = motelRoomData;
            }
          }
        }
        if (
          resData.data[i].paymentMethod !== "none" &&
          resData.data[i].type === "monthly"
        ) {
          data.push(resData.data[i]);
        } else if (
          resData.data[i].paymentMethod === "none" &&
          resData.data[i].type === "monthly"
        ) {
          dataNone.push(resData.data[i]);
        }
      }
      const dataRes = {
        data: [],
        dataNone: [],
      };
      console.log({ sizeOfData: data.length });
      const userData = req["userId"];
      if (data.length > 0) {
        for (let j = 0; j < data.length; j++) {
          if (data[j].motelRoomDataDetail) {
            if (data[j].motelRoomDataDetail.owner == userData.toString()) {
              dataRes.data.push(data[j]);
            }
          }
        }
      }
      console.log({ sizeOfDataNone: dataNone.length });
      if (dataNone.length > 0) {
        for (let k = 0; k < dataNone.length; k++) {
          if (
            dataNone[k] &&
            dataNone[k].motelRoomDataDetail &&
            dataNone[k].motelRoomDataDetail.owner &&
            dataNone[k].motelRoomDataDetail.owner == userData.toString()
          ) {
            dataRes.dataNone.push(dataNone[k]);
          }
        }
      }
      console.log({
        sizeOfResultData: dataRes.data.length,
        sizeOfResultDataNone: dataRes.dataNone.length,
      });
      return HttpResponse.returnSuccessResponse(res, dataRes);
    } catch (e) {
      console.log({ e });
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/admin/homeKey/order/{id}:
   *   get:
   *     description: Get order by id
   *     tags: [Order]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         type: string
   *         description: orderId
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */

  static async getOrderByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { order: OrderModel } = global.mongoModel;

      let resData = await OrderModel.findOne({
        _id: req.params.id,
        isDeleted: false,
      })
        .populate([
          {
            model: "User",
            path: "user",
            select: { password: 0, token: 0, isDeleted: 0, _v: 0 },
          },
        ])
        .lean()
        .populate("UNC")
        .exec();

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }
      if (resData.UNC) {
        resData.UNC = await helpers.getImageUrl(resData.UNC);
      }

      return HttpResponse.returnSuccessResponse(res, resData);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * definitions:
   *   Order:
   *     properties:
   *       amount:
   *         type: number
   */

  /**
   * @swagger
   * /v1/admin/homeKey/order/{id}:
   *   put:
   *     description: Get order by id
   *     tags: [Order]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         type: string
   *         description: orderId
   *       - name: body
   *         in: body
   *         required:  true
   *         description: motel room data
   *         schema:
   *           type:  object
   *           $ref: '#definitions/Order'
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */

  static async editOrderByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { order: OrderModel } = global.mongoModel;

      let resData = await OrderModel.findOne({
        _id: req.params.id,
        isDeleted: false,
      })
        .populate([
          {
            model: "User",
            path: "user",
            select: { password: 0, token: 0, isDeleted: 0, _v: 0 },
          },
        ])
        .lean()
        .exec();

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }

      const imageService = new ImageService("local", true);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      let { body: data } = req;

      return HttpResponse.returnSuccessResponse(
        res,
        await OrderModel.findOneAndUpdate(
          { _id: resData._id },
          lodash.omitBy({ amount: data.amount }, lodash.isUndefined),
          { new: true }
        )
      );
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/room/{id}/order:
   *   put:
   *     description: Edit order by room
   *     tags: [Order]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         type: string
   *         description: roomId
   *       - name: body
   *         in: body
   *         required:  true
   *         description: motel room data
   *         schema:
   *           type:  object
   *           $ref: '#definitions/Order'
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */

  static async editOrderByOwner(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const {
        room: roomModel,
        job: jobModel,
        order: OrderModel,
      } = global.mongoModel;

      let roomData = await roomModel
        .findOne({
          _id: req.params.id,
          isDeleted: false,
        })
        .lean()
        .exec();

      if (!roomData) {
        return HttpResponse.returnBadRequestResponse(res, "room.not.exist");
      }

      if (roomData.status === "available") {
        return HttpResponse.returnBadRequestResponse(res, "room.is.available");
      }

      let jobData = await jobModel
        .findOne({ room: roomData._id, isDeleted: false })
        .lean()
        .exec();

      if (!jobData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "room.have.not.order"
        );
      }

      // if (jobData.status !== 'pendingMonthlyPayment') {
      //   return HttpResponse.returnBadRequestResponse(res, 'job.not.pendingMonthlyPayment');
      // }

      let orderData = await OrderModel.findOne({
        _id: jobData.currentOrder,
        isDeleted: false,
      })
        .lean()
        .exec();

      if (!orderData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }

      const imageService = new ImageService("local", true);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      let { body: data } = req;

      return HttpResponse.returnSuccessResponse(
        res,
        await OrderModel.findOneAndUpdate(
          { _id: orderData._id },
          lodash.omitBy({ amount: data.amount }, lodash.isUndefined),
          { new: true }
        )
      );
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/admin/homeKey/order/{id}:
   *   delete:
   *     description: Delete order by id
   *     tags: [Order]
   *     produces:
   *       - application/json
   *       - multipart/form-data
   *     parameters:
   *       - name: id
   *         in: path
   *         type: string
   *         description: orderId
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */

  static async deleteOrderByAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      // Init models
      const { order: orderModel } = global.mongoModel;

      let resData = await orderModel
        .findOne({ _id: req.params.id, isDeleted: false })
        .populate([
          {
            model: "User",
            path: "user",
            select: { password: 0, token: 0, isDeleted: 0, _v: 0 },
          },
        ])
        .lean()
        .exec();

      if (!resData) {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Đơn hàng không tồn tại"
        );
      }

      if (resData.type !== "recharge") {
        return HttpResponse.returnBadRequestResponse(
          res,
          "Đơn hàng không được xóa"
        );
      }

      const imageService = new ImageService("local", true);

      // Process form data
      const processDataInfo = await imageService.processFormData(req, res);

      if (processDataInfo && processDataInfo.error) {
        return HttpResponse.returnBadRequestResponse(
          res,
          processDataInfo.error
        );
      }

      await orderModel.remove({ _id: req.params.id }).exec();

      return HttpResponse.returnSuccessResponse(res, null);
    } catch (e) {
      next(e);
    }
  }

  /**
   * @swagger
   * /v1/admin/order/{userId}:
   *   get:
   *     description: Get order job by user
   *     tags: [Order]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: userId
   *         in: path
   *         type: string
   *         description: User id
   *       - name: size
   *         in: query
   *         description: Number of order returned
   *         type:  integer
   *         default: 20
   *       - name: page
   *         in: query
   *         default: 0
   *         description: Current page
   *         type:  integer
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   *     security:
   *       - auth: []
   */
  //   Get List User to Order
  static async getOrderByUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const id = req.params.id;
      console.log({ id });
      // Init models
      const {
        order: OrderModel,
        user: UserModel,
        job: jobModel,
        floor: floorModel,
        room: roomModel,
        motelRoom: motelRoomModel,
      } = global.mongoModel;
      const customer = await UserModel.findById(id);
      if (!customer)
        return HttpResponse.returnBadRequestResponse(res, [
          "Customer could not be found",
        ]);

      const resData = await OrderModel.find({ user: customer._id })
        .populate([
          {
            model: "User",
            path: "user",
            select: "firstName lastName phoneNumber",
          },
        ])
        .populate([
          {
            model: "Job",
            path: "job",
            select: "room",
          },
        ])
        .lean()
        .exec();

      const data = [];
      if (!resData) {
        return HttpResponse.returnBadRequestResponse(res, "order.not.exist");
      }
      for (let i = 0; i < resData.length; i++) {
        const item = resData[i];
        // Get room
        const room = await roomModel
          .findById(item.job.room)
          .lean()
          .select("name key")
          .exec();
        if (room) {
          // Get floor
          const floor = await floorModel
            .findOne({ rooms: { $in: [room._id] } })
            .lean()
            .exec();

          if (floor) {
            // Get motel room
            const motelRoom = await motelRoomModel
              .findOne({ floors: { $in: [floor._id] } })
              .populate([
                {
                  model: "Address",
                  path: "address",
                  select: "address",
                },
              ])
              .select("name address")
              .lean()
              .exec();

            // Push result into data
            data.push({
              ...item,
              motelRoom,
              room,
            });
          }
        }
      }

      console.log({ OrderByUser: data });

      return HttpResponse.returnSuccessResponse(res, data);
    } catch (e) {
      next(e);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            START HELPER FUNCTION                           */
  /* -------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------- */
  /*                             END HELPER FUNCTION                            */
  /* -------------------------------------------------------------------------- */
}
