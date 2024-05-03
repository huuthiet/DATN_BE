import { NextFunction, Request, Response } from "express";
import * as mongoose from "mongoose";
import HttpResponse from "../../services/response";

export default class BillController {
  /* -------------------------------------------------------------------------- */
  /*                            START HELPER FUNCTION                           */
  /* -------------------------------------------------------------------------- */
  /**
   * @swagger
   * tags:
   *   - name: Bill
   *     description: Bill Control
   */

  static async insertDb(data, userId): Promise<any> {
    const {
      bill: billModel,
      optionsType: OptionsTypeModel,
    } = global.mongoModel;
    // check trung ma hoa đơn
    const dataCheck = await billModel
      .findOne({
        idBill: data.idBill,
      })
      .lean()
      .exec();
    // If user was deleted
    if (dataCheck) {
      return HttpResponse.returnErrorWithMessage("Mã Hóa Đơn tồn tại");
    }

    let billData = await billModel.create({
      user: userId,
      typeTaxAll: data.typeTaxAll,
      totalTaxAll: data.totalTaxAll,
      totalAndTaxAll: data.totalAndTaxAll,
      totalAll: data.totalAll,
      imgRoom: data.imgRoom,
      address: data.address,
      phoneUser: data.phoneUser,
      nameUser: data.nameUser,
      nameRoom: data.nameRoom,
      nameMotel: data.nameMotel,
      dateBill: data.dateBill,
      idBill: data.idBill,
      emailOwner: data.emailOwner,
    });

    const Room = await OptionsTypeModel.create({
      expense: data.expenseRoom,
      type: data.typeRoom,
      unitPrice: data.unitPriceRoom,
      total: data.totalRoom,
    });

    const Electricity = await OptionsTypeModel.create({
      expense: data.expenseElectricity,
      type: data.typeElectricity,
      unitPrice: data.unitPriceElectricity,
      total: data.totalElectricity,
    });

    const Water = await OptionsTypeModel.create({
      expense: data.expenseWater,
      type: data.typeWater,
      unitPrice: data.unitPriceWater,
      total: data.totalWater,
    });

    const Garbage = await OptionsTypeModel.create({
      expense: data.expenseGarbage,
      type: data.typeGarbage,
      unitPrice: data.unitPriceGarbage,
      total: data.totalGarbage,
    });

    const Wifi = await OptionsTypeModel.create({
      expense: data.expenseWifi,
      type: data.typeWifi,
      unitPrice: data.unitPriceWifi,
      total: data.totalWifi,
    });

    const Other = await OptionsTypeModel.create({
      expense: data.expenseOther,
      type: data.typeOther,
      unitPrice: data.unitPriceOther,
      total: data.totalOther,
    });

    billData = await billModel
      .findOneAndUpdate(
        { _id: billData._id },
        {
          room: Room._id,
          other: Other._id,
          wifi: Wifi._id,
          water: Water._id,
          garbage: Garbage._id,
          electricity: Electricity._id,
        },
        { new: true }
      )
      .lean()
      .exec();

    if (!billData) {
      return HttpResponse.returnErrorWithMessage("Hóa không tồn tại", "");
    }

    // Return floor data
    return billData._id;
  }

  /**
   * @swagger
   * definitions:
   *   CreateBill:
   *     required:
   *       - email
   *       - password
   *     properties:
   *       email:
   *         type: string
   *       password:
   *         type: string
   */

  /**
   * @swagger
   * /v1/homeKey/bill:
   *   post:
   *     description: Create bill
   *     tags: [Bill]
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: body
   *         name: body
   *         description: Request body
   *         schema:
   *           $ref: '#definitions/CreateBill'
   *           type: object
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */

  static async createBill(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    // Init models
    try {
      const {
        bill: billModel,
        optionsType: OptionsTypeModel,
      } = global.mongoModel;
      const { body: data } = req;
      const billData = BillController.insertDb(data, req["userId"]);

      return HttpResponse.returnSuccessResponse(
        res,
        await BillController.getBillById(billData)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /v1/homeKey/bill/{id}:
   *   post:
   *     description: Get bill detail
   *     tags: [Bill]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         type: string
   *         description: Bill id
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */
  static async getBillDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      let { id: billId } = req.params;

      return HttpResponse.returnSuccessResponse(
        res,
        await BillController.getBillById(billId)
      );
    } catch (e) {
      next(e);
    }
  }

  // Get billId by id
  static async getBillById(billId: any, lang?: string): Promise<any> {
    const { bill: billModel } = global.mongoModel;

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return HttpResponse.returnErrorWithMessage("Hóa đơn không tồn tại", lang);
    }

    let resData = await billModel
      .findOne({ _id: billId })
      .populate("electricity garbage water wifi other room")
      .lean()
      .exec();

    if (!resData) {
      return HttpResponse.returnErrorWithMessage("Hóa không tồn tại", lang);
    }

    // Return floor data
    return resData;
  }

  // Get all Bill
  /**
   * @swagger
   * /v1/homeKey/bill:
   *   get:
   *     description: Get list of bills
   *     tags: [Bill]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: sortBy
   *         in: query
   *         required: true
   *         description: Sort by value
   *         type: string
   *       - name: size
   *         in: query
   *         required: true
   *         description: Size of page
   *         type: string
   *       - name: page
   *         in: query
   *         required: true
   *         description: Current page
   *         type: string
   *       - name: startDate
   *         in: query
   *         required: true
   *         description: Filter from startDate
   *         type: string
   *       - name: endDate
   *         in: query
   *         required: true
   *         description: Filter from startDate to endDate
   *         type: string
   *       - name: keyword
   *         in: query
   *         required: false
   *         description: Filter by keyword
   *         type: string
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */
  static async getBillList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    const { bill: billModel } = global.mongoModel;

    const sortType = req.query.sortType === "ascending" ? 1 : -1;
    let { sortBy, role, size, page, keyword, startDate, endDate } = req.query;
    let condition, sort;

    condition = [
      {
        $project: {
          isDeleted: 0,
          "user.password": 0,
          "user.token": 0,
          "user.isDeleted": 0,
          "user._v": 0,
        },
      },
      {
        $match: {
          user: req["userId"],
          createdAt: {
            $gte: new Date(startDate.toString()), // lớn hơn
            $lte: new Date(endDate.toString()), // nhỏ hơn
          },
        },
      },
    ];

    if (sortBy && sortType) {
      switch (sortBy) {
        case "createdAt": {
          sort = { createdAt: sortType };
          break;
        }
        case "updatedAt": {
          sort = { updatedAt: sortType };
          break;
        }
        default:
          sort = { createdAt: -1 };
      }
      condition.push({ $sort: sort });
    }

    const resData = await billModel.paginate(size, page, condition);

    if (!resData) {
      return HttpResponse.returnBadRequestResponse(
        res,
        "Danh sách hóa đơn không tồn tại"
      );
    }
    return HttpResponse.returnSuccessResponse(res, resData);
  }

  // Get all Bill with admin role
  /**
   * @swagger
   * /v1/homeKey/admin/bill:
   *   get:
   *     description: Get list of bills with admin role
   *     tags: [Bill]
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: sortBy
   *         in: query
   *         required: true
   *         description: Sort by value
   *         type: string
   *       - name: size
   *         in: query
   *         required: true
   *         description: Size of page
   *         type: string
   *       - name: page
   *         in: query
   *         required: true
   *         description: Current page
   *         type: string
   *       - name: startDate
   *         in: query
   *         required: true
   *         description: Filter from startDate
   *         type: string
   *       - name: endDate
   *         in: query
   *         required: true
   *         description: Filter from startDate to endDate
   *         type: string
   *       - name: keyword
   *         in: query
   *         required: false
   *         description: Filter by keyword
   *         type: string
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */
  static async getBillListAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    const { bill: billModel } = global.mongoModel;

    const sortType = req.query.sortType === "ascending" ? 1 : -1;
    let { sortBy, role, size, page, keyword, startDate, endDate } = req.query;
    let condition, sort;

    condition = [
      {
        $project: {
          isDeleted: 0,
          "user.password": 0,
          "user.token": 0,
          "user.isDeleted": 0,
          "user._v": 0,
        },
      },
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate.toString()), // lớn hơn
            $lte: new Date(endDate.toString()), // nhỏ hơn
          },
        },
      },
    ];

    if (sortBy && sortType) {
      switch (sortBy) {
        case "createdAt": {
          sort = { createdAt: sortType };
          break;
        }
        case "updatedAt": {
          sort = { updatedAt: sortType };
          break;
        }
        default:
          sort = { createdAt: -1 };
      }
      condition.push({ $sort: sort });
    }

    const resData = await billModel.paginate(size, page, condition);

    if (!resData) {
      return HttpResponse.returnBadRequestResponse(
        res,
        "Không có danh sách hóa đơn không tồn tại"
      );
    }
    return HttpResponse.returnSuccessResponse(res, resData);
  }

  /**
   * @swagger
   * /v1/homeKey/bill/customer:
   *   post:
   *     description: Get all bill of customer
   *     tags: [Bill]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Success
   *       400:
   *         description: Invalid request params
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Resource not found
   */
  // Get bill for customer role
  static async getAllBillsOfCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    const { user: UserModel, bill: BillModel } = global.mongoModel;

    // Get userId
    const userId: string = req["userId"];
    console.log({ userId });

    // Validate user role is customer
    const customer = await UserModel.findOne({
      _id: userId,
    })
      .lean()
      .exec();
    if (!customer)
      return HttpResponse.returnBadRequestResponse(res, [
        "User could not be found",
      ]);
    console.log({ customer });

    const bills = await BillModel.find({
      phoneUser: `0${customer.phoneNumber.number}`,
    }).exec();
    console.log({ bills });

    return HttpResponse.returnSuccessResponse(res, {
      message: "Get all bill of customer successful",
      data: bills,
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                             END HELPER FUNCTION                            */
  /* -------------------------------------------------------------------------- */
}
