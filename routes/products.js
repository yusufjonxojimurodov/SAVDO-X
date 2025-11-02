const express = require("express");
const router = express.Router();
const ProductModel = require("../models/products");
const tokenCheck = require("../middleware/token.js");
const multer = require("multer");
const FormData = require("form-data");
const permission = require("../utils/roleCheck.js");
const Comment = require("../models/coment.js");
const Complaint = require("../models/complaint.models.js");
const { bot } = require("../bot/index.js");
const formatProduct = require("../middleware/format.product.js");

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", async (req, res) => {
  try {
    const filter = { status: "ONSALE" };

    if (req.query.model) filter.model = req.query.model;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: "i" };
    }

    const sortOption =
      req.query.price === "expensive"
        ? { price: -1 }
        : req.query.price === "cheap"
        ? { price: 1 }
        : {};

    const products = await ProductModel.find(filter)
      .populate("createdBy", "userName")
      .sort(sortOption)
      .lean();

    if (!products.length) {
      return res.status(200).json([]);
    }

    const productIds = products.map((p) => p._id);

    const ratingStats = await Comment.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: "$productId",
          happyCount: {
            $sum: { $cond: [{ $eq: ["$rating", "happy"] }, 1, 0] },
          },
          unhappyCount: {
            $sum: { $cond: [{ $eq: ["$rating", "unhappy"] }, 1, 0] },
          },
        },
      },
    ]);

    const ratingMap = {};
    for (const r of ratingStats) {
      const total = r.happyCount + r.unhappyCount;
      const happyPercent = total ? Math.round((r.happyCount / total) * 100) : 0;
      const unhappyPercent = 100 - happyPercent;

      ratingMap[r._id.toString()] = {
        happy: happyPercent,
        unhappy: unhappyPercent,
      };
    }

    const result = products.map((product) => ({
      ...formatProduct(product),
      rating: ratingMap[product._id.toString()] || { happy: 0, unhappy: 0 },
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get(
  "/my",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const filter = { createdBy: req.userId };

      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: "i" };
      }

      if (req.query.model) {
        filter.model = req.query.model;
      }

      const myProducts = await ProductModel.find(filter);

      res.json(myProducts.map(formatProduct));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.post(
  "/create-product",
  tokenCheck,
  permission(["admin", "seller"]),
  upload.array("images", 4),
  async (req, res) => {
    try {
      const { name, description, price, left, type, discount, model } =
        req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "Rasmlar yuklash majburiy!" });
      }

      const discountPrice = discount ? price - (price * discount) / 100 : price;

      const newProduct = new ProductModel({
        name,
        description,
        price,
        model,
        type,
        discount,
        discountPrice,
        left,
        status: "ONSALE",
        createdBy: req.userId,
        images: req.files.map((file) => ({
          data: file.buffer,
          contentType: file.mimetype,
        })),
      });

      await newProduct.save();

      const populatedProduct = await ProductModel.findById(
        newProduct._id
      ).populate("createdBy", "userName");

      res.status(201).json(formatProduct(populatedProduct));
    } catch (err) {
      console.error("Xatolik:", err);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.get("/get/:id", async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id).populate(
      "createdBy",
      "userName"
    );

    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const happyCount = await Comment.countDocuments({
      productId: product._id,
      rating: "happy",
    });
    const unhappyCount = await Comment.countDocuments({
      productId: product._id,
      rating: "unhappy",
    });
    const total = happyCount + unhappyCount;

    let happyPercent = 0;
    let unhappyPercent = 0;

    if (total > 0) {
      happyPercent = Math.round((happyCount / total) * 100);
      unhappyPercent = 100 - happyPercent;
    }

    const formattedProduct = {
      ...formatProduct(product),
      rating: {
        happy: happyPercent,
        unhappy: unhappyPercent,
      },
    };

    res.json(formattedProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.delete(
  "/my/:id",
  tokenCheck,
  permission(["admin", "seller"]),
  async (req, res) => {
    try {
      const productId = req.params.id;
      const userId = req.userId;

      const product = await ProductModel.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      if (req.role === "admin") {
        await ProductModel.findByIdAndDelete(productId);
        return res.status(200).json({ message: "Mahsulotni admin o‘chirdi" });
      }

      if (req.role === "seller") {
        if (product.createdBy.toString() !== userId.toString()) {
          return res
            .status(403)
            .json({ message: "Sizda bu mahsulotni o‘chirish huquqi yo‘q" });
        }

        await ProductModel.findByIdAndDelete(productId);
        return res
          .status(200)
          .json({ message: "Mahsulot muvaffaqiyatli o‘chirildi" });
      }

      res.status(403).json({ message: "Sizda ruxsat yo‘q" });
    } catch (err) {
      console.error("DELETE /my/:id error:", err.message);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.put(
  "/my/product/edit/:id",
  tokenCheck,
  permission(["admin", "seller"]),
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, left, model, discount, type, image } =
        req.body;
      const productId = req.params.id;
      const userId = req.userId;

      let product = await ProductModel.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      if (product.createdBy.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Sizda bu mahsulotni tahrirlash huquqi yo‘q" });
      }

      if (req.image) {
        product.image = {
          data: req.image.buffer,
          contentType: req.image.mimetype,
        };
      }

      product.name = name ?? product.name;
      product.image = image ?? product.image;
      product.description = description ?? product.description;
      product.price = price ?? product.price;
      product.left = left ?? product.left;
      product.model = model ?? product.model;
      product.type = type ?? product.type;
      product.discount = discount ?? product.discount;
      product.discountPrice = product.discount
        ? product.price - (product.price * product.discount) / 100
        : product.price;

      await product.save();

      const updatedProduct = await ProductModel.findById(productId).populate(
        "createdBy",
        "userName"
      );

      res.json(formatProduct(updatedProduct));
    } catch (err) {
      console.error("PUT /my/product/edit error:", err.message);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.get("/products/admin", async (req, res) => {
  try {
    let { page = 0, size = 10, search, type, model } = req.query;

    page = Number(page);
    size = Number(size);

    if (isNaN(page) || page < 0) page = 0;
    if (isNaN(size) || size <= 0) size = 10;

    const skip = page * size;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (type) {
      filter.type = type;
    }

    if (model) {
      filter.model = model;
    }

    const products = await ProductModel.find(filter)
      .select(
        "name description price discount discountPrice left model type status"
      )
      .populate("createdBy", "userName")
      .skip(skip)
      .limit(size)
      .sort({ createdAt: -1 });

    const total = await ProductModel.countDocuments(filter);

    res.json({
      page,
      size,
      totalPages: Math.ceil(total / size),
      totalProducts: total,
      products,
    });
  } catch (err) {
    console.error("Pagination error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.get("/product/:id/image/:index", async (req, res) => {
  const product = await ProductModel.findById(req.params.id);
  if (!product || !product.images || product.images.length === 0) {
    return res.status(404).send("Image not found");
  }

  const index = parseInt(req.params.index, 10);
  const image = product.images[index];
  if (!image) return res.status(404).send("Image not found");

  const etag = `"${image.data.toString("base64").slice(0, 20)}"`;

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set({
    "Content-Type": image.contentType,
    "Cache-Control": "public, max-age=31536000",
    ETag: etag,
  });

  res.send(image.data);
});

router.post("/complaint/:productId", tokenCheck, async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, surname, phone, userName, message } = req.body;

    const product = await ProductModel.findById(productId).populate(
      "createdBy",
      "chatId userName name surname phone"
    );
    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    const complaint = new Complaint({
      product: product._id,
      productName: product.name,
      productType: product.type,
      productModel: product.model,

      seller: {
        id: product.createdBy._id,
        name: product.createdBy.name,
        surname: product.createdBy.surname,
        userName: product.createdBy.userName,
        phone: product.createdBy.phone,
      },

      complainant: {
        name,
        surname,
        userName,
        phone,
      },

      message,
    });

    await complaint.save();

    if (product.createdBy.chatId) {
      const complaintMsg =
        `⚠️ Mahsulotga shikoyat ⚠️\n\n` +
        `📦 Mahsulot: ${product.name}\n` +
        `🔖 Turi: ${product.type || "-"}\n` +
        `📌 Model: ${product.model || "-"}\n\n` +
        `👤 Shikoyatchi: ${name} ${surname}\n` +
        `📞 Telefon: ${phone}\n` +
        `🔗 Username: ${userName ? "@" + userName : "Anonim"}\n\n` +
        `💬 Xabar:\n${message}`;

      try {
        await bot.sendMessage(product.createdBy.chatId, complaintMsg);
      } catch (err) {
        console.error("Botga xabar yuborilmadi:", err.message);
      }
    }

    res
      .status(201)
      .json({ message: "Shikoyat muvaffaqiyatli yuborildi", complaint });
  } catch (err) {
    console.error("Complaint error:", err.message);
    res.status(500).json({ message: "Server xatosi" });
  }
});

router.put(
  "/:id/status",
  tokenCheck,
  permission(["admin", "seller", "moderator"]),
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!["ONSALE", "NOTFORSALE"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Status noto‘g‘ri qiymatga ega" });
      }

      const updateStatus = await ProductModel.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
      );

      if (!updateStatus) {
        return res.status(404).json({ message: "Mahsulot topilmadi" });
      }

      res.status(200).json({
        message: `Mahsulot statusi ${
          status === "ONSALE" ? "Sotuvga qo'yildi" : "Sotuvdan olib tashlandi"
        }`,
        product: {
          id: updateStatus._id,
          name: updateStatus.name,
          status: updateStatus.status,
          updatedAt: updateStatus.updatedAt.getTime(),
        },
      });
    } catch (err) {
      console.error("PUT /product/:id/status error:", err.message);
      res.status(500).json({ message: "Server xatosi" });
    }
  }
);

router.put(
  "/update/product/admin/:id",
  tokenCheck,
  permission(["admin", "moderator"]),
  async (req, res) => {
    try {
      // image maydonini yangilashni bloklaymiz
      const { image, ...safeData } = req.body;

      // Bazada faqat image'dan tashqari maydonlarni yangilaymiz
      const updateProduct = await ProductModel.findByIdAndUpdate(
        req.params.id,
        safeData,
        { new: true }
      ).populate("createdBy", "userName"); // faqat userName ni oladi

      if (!updateProduct) {
        return res.status(404).json({
          message: "Mahsulot topilmadi",
        });
      }

      // Object'ga aylantirib, image ni response'dan olib tashlaymiz
      const productWithoutImage = updateProduct.toObject();
      delete productWithoutImage.image;

      res.status(200).json({
        message: "Mahsulot yangilandi",
        product: productWithoutImage,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Server xatosi",
        error: error.message,
      });
    }
  }
);

module.exports = router;
