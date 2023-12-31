const Product = require("../models/productModel");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongoDbId");
const slugify = require("slugify");

//create a New Product
const createProduct = asyncHandler(async (req, res) => {
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const newProduct = await Product.create(req.body);
    res.json(newProduct);
  } catch (error) {
    throw new Error(error);
  }
});

//delete a Product

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deleteProduct = await Product.findByIdAndDelete(id);
    res.json(deleteProduct);
  } catch (error) {
    throw new Error(error);
  }
});

//update Product

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const updateProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json(updateProduct);
  } catch (error) {
    throw new Error(error);
  }
});

//get a Product
const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const findProduct = await Product.findById(id);
    res.json(findProduct);
  } catch (error) {
    throw new Error(error);
  }
});

// get all Product

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    ///filter product
    const queryObj = { ...req.query };
    const excludeFields = ["page", "limit", "sort", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]); // delete all fields if available
    console.log(queryObj);
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    let query = Product.find(JSON.parse(queryStr));

    // sorting
    // if (req.query.sort) {
    //   const sortBy = req.query.sort.split(",").join(" ");
    //   query = query.sort(sortBy);
    // } else {
    //   query = query.sort("-createdAt");
    // }

    const sortBy = req.query.sort
      ? req.query.sort.split(",").join(" ")
      : "-createdAt";
    query = query.sort(sortBy);

    //limiting the fields
    // if (req.query.fields) {
    //   const fields = req.query.fields.split(",").join(" ");
    //   query = query.sort(fields);
    // } else {
    //   query = query.sort("-__v");
    // }

    const fields = req.query.fields
      ? req.query.fields.split(",").join(" ")
      : "-__v";
    query = query.select(fields);

    //pagination
    // const page = req.query.page;
    // const limit = req.query.limit;
    // if (req.query.page) {
    //   const productCount = await Product.countDocuments();
    //   if (skip >= productCount) throw new Error("This page does not exists");
    // }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);
    if (page > 1) {
      const productCount = await Product.countDocuments();
      if (skip >= productCount) {
        throw new Error("This page does not exist");
      }
    }

    const product = await query;
    res.json(product);
  } catch (error) {
    throw new Error(error);
  }
});


//addTwishlist

const addToWishlist = asyncHandler(async(req, res)=> {
  const { _id } = req.user;
  const { prodId } = req.body;
  try {
    const user = await User.findById(_id);
    const alreadyadded = await user.wishlist.find((id)=> id.toString() === prodId);
    if (alreadyadded) {
      let user = await User.findByIdAndUpdate(
        _id,
        {
          $pull: { wishlist: prodId }
        },
        {
          new: true
        }
      )
      res.json(user);
    } else {
      let user = await User.findByIdAndUpdate(
        _id,
        {
          $push: { wishlist: prodId }
        },
        {
          new: true
        }
      )
      res.json(user);
    }
  } catch (error) {
    throw new Error(error);
  }

})
module.exports = {
  createProduct,
  getaProduct,
  getAllProduct,
  deleteProduct,
  updateProduct,
  addToWishlist
};
