const User = require("../models/userModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Order = require("../models/orderModel");
const { generateToken } = require("../config/jwtToken");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongoDbId");
const { generateRefreshToken } = require("../config/generateRefreshToken");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("./emailController");
const uniqid = require("uniqid");
const passport = require("passport");
//Register account

const createUser = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.status(400).json({ error: "User with this email already exists" });
    }
    const newUser = new User(req.body);
    const user = await newUser.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

//user login
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // check if user exists or not
  const findUser = await User.findOne({ email });
  if (findUser && (await findUser.isPasswordMatched(password))) {
    const refreshToken = await generateRefreshToken(findUser?._id);
    const updateUser = await User.findByIdAndUpdate(
      findUser.id,
      {
        refreshToken: refreshToken,
      },
      {
        new: true,
      }
    );
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      _id: findUser._id,
      firstname: findUser?.firstname,
      lastname: findUser?.lastname,
      email: findUser?.email,
      mobile: findUser?.mobile,
      role: findUser?.role,
      token: generateToken(findUser?._id),
    });
  } else {
    throw new Error("Invalid Credentials");
  }
});

//handle RefreshToken

const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No RefreshToken in Cookie");
  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });
  if (!user) throw new Error("No refreshToken present in db or not matched");
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || user.id != decoded.id) {
      throw new Error("There is something wrong with refresh token");
    }
    const accessToken = generateToken(user?._id);
    res.json({ accessToken });
  });
});

// logout

const logout = asyncHandler(async (req, res) => {
  try {
    const cookie = req.cookies;
    if (!cookie?.refreshToken) throw new Error("No RefreshToken in Cookie");
    const refreshToken = cookie.refreshToken;
    const user = await User.findOne({ refreshToken });
    if (!user) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: true,
      });
      return res.sendStatus(403);
    }
    await User.findOneAndUpdate(
      { refreshToken },
      {
        refreshToken: "",
      }
    );
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
    });
    res.status(200).json("Logout successfully");
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

//get all users

const getallUser = asyncHandler(async (req, res) => {
  const query = req.query.new;
  try {
    const getUsers = query
      ? await User.find().sort({ _id: -1 })
      : await User.find();
    res.json(getUsers);
  } catch (err) {
    throw new Error(err);
  }
});

//get single user

const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const getaUser = await User.findById(id);
    const { password, ...info } = getaUser._doc;
    res.json(info);
  } catch (err) {
    throw new Error(err);
  }
});

//delete User

const deletedUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    res.json(deletedUser);
  } catch (err) {
    throw new Error(err);
  }
});

//update user

const updatedUser = asyncHandler(async (req, res) => {
  const { _id } = req.user; // user login already
  validateMongoDbId(_id);
  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        firstname: req?.body?.firstname,
        lastname: req?.body?.lastname,
        email: req?.body?.email,
        mobile: req?.body?.mobile,
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (err) {
    throw new Error(err);
  }
});

// save user Address

const saveAddress = asyncHandler(async (req, res, next) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        address: req?.body?.address,
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

//block-users

const blockUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const blockUsr = await User.findByIdAndUpdate(
      id,
      {
        isBlocked: true,
      },
      {
        new: true,
      }
    );
    res.json(blockUsr);
  } catch (err) {
    throw new Error(err);
  }
});

//unblock-users

const unblockUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await User.findByIdAndUpdate(
      id,
      {
        isBlocked: false,
      },
      {
        new: true,
      }
    );
    res.json("User Unblocked");
  } catch (err) {
    throw new Error(err);
  }
});

//update password
const updatePassword = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    const { password } = req.body;
    validateMongoDbId(_id);
    const user = await User.findById(_id);
    const isMatch = await user.isPasswordMatched(password);
    if (isMatch) {
      res
        .status(400)
        .json("The new password cannot be the same as the old password");
    } else if (password) {
      user.password = password;
      const updatedPassword = await user.save();
      res.json(updatedPassword);
    } else {
      res.json(user);
    }
  } catch (error) {
    throw new Error(error);
  }
});

//forgot-password-token
const forgotPasswordToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found with this email");
    const token = await user.createPasswordResetToken();
    await user.save();

    const resetURL = `http://localhost:8000/api/auth/reset-password/${token}`;

    const data = {
      to: email,
      subject: "Forgot Password Link",
      html: `Hi, Please follow this link to reset Your Password. This link is valid for the next 10 minutes. <a href='${resetURL}'>Click Here</a>`,
    };

    sendEmail(data);
    res.json({ token });
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
});

//reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new Error("Toke Expired, Please try again later");
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json(user);
});

//getWishlist

const getWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  try {
    const findUser = await User.findById(_id).populate("wishlist");
    res.json(findUser);
  } catch (error) {
    throw new Error(error);
  }
});

//addToCart
const addToCart = asyncHandler(async (req, res) => {
  const { cart } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const user = await User.findById(_id);
    // check if user already have product in cart
    let alreadyExistCart = await Cart.findOne({ orderby: user._id });
    if (!alreadyExistCart) {
      alreadyExistCart = new Cart({ orderby: user._id });
    }
    for (let i = 0; i < cart.length; i++) {
      const existingProductIndex = alreadyExistCart.products.findIndex(
        (p) => p.product.toString() === cart[i]._id
      );
      if (existingProductIndex >= 0) {
        // product already exists in the cart, update the quantity
        alreadyExistCart.products[existingProductIndex].count += cart[i].count;
      } else {
        // new product, add to cart
        let object = {};
        object.product = cart[i]._id;
        object.count = cart[i].count;
        object.color = cart[i].color;
        let getPrice = await Product.findById(cart[i]._id)
          .select("price")
          .exec();
        object.price = getPrice.price;
        alreadyExistCart.products.push(object);
      }
    }
    let cartTotal = 0;
    for (let i = 0; i < alreadyExistCart.products.length; i++) {
      cartTotal =
        cartTotal +
        alreadyExistCart.products[i].price * alreadyExistCart.products[i].count;
    }
    alreadyExistCart.cartTotal = cartTotal;
    let newCart = await alreadyExistCart.save();
    res.json(newCart);
  } catch (error) {
    throw new Error(error);
  }
});

const updateCart = asyncHandler(async (req, res) => {
  const { cart } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const user = await User.findById(_id);
    let existingCart = await Cart.findOne({ orderby: user._id });

    if (!existingCart) {
      // If the user doesn't have a cart, return an error or handle as per your application logic
      return res.status(404).json({ message: "Cart not found for the user" });
    }

    for (let i = 0; i < cart.length; i++) {
      const existingProductIndex = existingCart.products.findIndex(
        (p) => p.product.toString() === cart[i]._id
      );

      if (existingProductIndex >= 0) {
        // Product already exists in the cart, update the quantity
        existingCart.products[existingProductIndex].count = cart[i].count;
      } else {
        // New product, add it to the cart
        const newProduct = {
          product: cart[i]._id,
          count: cart[i].count,
          color: cart[i].color,
        };
        let getPrice = await Product.findById(cart[i]._id)
          .select("price")
          .exec();
        newProduct.price = getPrice.price;
        existingCart.products.push(newProduct);
      }
    }

    let cartTotal = 0;
    for (let i = 0; i < existingCart.products.length; i++) {
      cartTotal +=
        existingCart.products[i].price * existingCart.products[i].count;
    }
    existingCart.cartTotal = cartTotal;

    let updatedCart = await existingCart.save();
    res.json(updatedCart);
  } catch (error) {
    throw new Error(error);
  }
});

// remove products from cart

const removeFromCart = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { _id } = req.user;
    validateMongoDbId(_id);
    validateMongoDbId(productId);
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const cart = await Cart.findOne({ orderby: user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    const productIndexes = cart.products.reduce((indexes, product, index) => {
      if (product.product.toString() === productId) {
        indexes.push(index);
      }
      return indexes;
    }, []);
    if (productIndexes.length === 0) {
      return res.status(404).json({ error: "Product not found in the cart" });
    }
    productIndexes.forEach((index) => {
      cart.products.splice(index, 1);
    });
    cart.cartTotal = cart.products.reduce(
      (total, product) => total + product.price * product.count,
      0
    );
    await cart.save();
    res.json(cart);
  } catch (error) {
    console.error("Error removing product from cart:", error);
    throw new Error(error);
  }
});

//get your cart
const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const cart = await Cart.findOne({ orderby: _id }).populate(
      "products.product"
    );
    res.json(cart);
  } catch (error) {
    throw new Error(error);
  }
});

//empty cart
const emptyCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const user = await User.findOne({ _id });
    const cart = await Cart.findOneAndDelete({ orderby: user._id });
    res.json(cart);
  } catch (error) {
    throw new Error(error);
  }
});

//apply coupon

// const applyCoupon = asyncHandler(async (req, res) => {
//   const { coupon } = req.body;
//   const { _id } = req.user;
//   validateMongoDbId(_id);
//   const validCoupon = await Coupon.findOne({ name: coupon });
//   if (!validCoupon) {
//     throw new Error("Invalid Coupon");
//   }
//   const user = await User.findOne({ _id });
//   let { cartTotal } = await Cart.findOne({
//     orderby: user._id,
//   }).populate("products.product");
//   if (!cartTotal) throw new Error("Cart not found");
//   let totalAfterDiscount = (
//     cartTotal -
//     (cartTotal * validCoupon.discount) / 100
//   ).toFixed(2);
//   await Cart.findOneAndUpdate(
//     { orderby: user._id },
//     { totalAfterDiscount },
//     { new: true }
//   );
//   res.json(totalAfterDiscount);
// });
const applyCoupon = asyncHandler(async (req, res) => {
  const { coupon } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);

  const validCoupon = await Coupon.findOne({ name: coupon });
  if (!validCoupon) {
    throw new Error("Invalid Coupon");
  }

  const cart = await Cart.findOne({ orderby: _id }).populate(
    "products.product"
  );
  if (!cart) {
    throw new Error("Cart not found");
  }

  let totalAfterDiscount = (
    cart.cartTotal -
    (cart.cartTotal * validCoupon.discount) / 100
  ).toFixed(2);

  cart.totalAfterDiscount = totalAfterDiscount;
  await cart.save();

  res.json(totalAfterDiscount);
});

//create order

const createOrder = asyncHandler(async (req, res) => {
  const { COD, couponApplied } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    if (!COD) throw new Error("Create cash order failed");
    const user = await User.findById(_id);
    let userCart = await Cart.findOne({ orderby: user._id });
    let finalAmout = 0;
    if (couponApplied && userCart.totalAfterDiscount) {
      finalAmout = userCart.totalAfterDiscount;
    } else {
      finalAmout = userCart.cartTotal;
    }

    let newOrder = await new Order({
      products: userCart.products,
      paymentIntent: {
        id: uniqid(),
        method: "COD",
        amount: finalAmout,
        status: "Cash on Delivery",
        created: Date.now(),
        currency: "usd",
      },
      orderby: user._id,
      orderStatus: "Cash on Delivery",
    }).save();
    // let update = userCart.products.map((item) => {
    //   return {
    //     updateOne: {
    //       filter: { _id: item.product._id },
    //       update: { $inc: { quantity: -item.count, sold: +item.count } },
    //     },
    //   };
    // });
    let update = userCart.products.map(async (item) => {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: -item.count } }
      );
    });
    // const updated = await Product.bulkWrite(update, {});
    res.json({ message: "success" });
  } catch (error) {
    console.log(error.message);
    throw new Error(error);
  }
});

//delete orders

const deleteOrder = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const user = await User.findOne({ _id });
    const order = await Order.findByIdAndDelete({ orderby: user._id });
    res.json(order);
  } catch (error) {
    console.log(error.message);
    throw new Error(error);
  }
});

//get order

const getOrders = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const userorders = await Order.findOne({ orderby: _id })
      .populate("products.product")
      .populate("orderby")
      .exec();
    res.json(userorders);
  } catch (error) {
    throw new Error(error);
  }
});

//get All orders

const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const alluserorders = await Order.find()
      .populate("products.product")
      .populate("orderby")
      .exec();
    res.json(alluserorders);
  } catch (error) {
    throw new Error(error);
  }
});

//update order status

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const updateOrderStatus = await Order.findByIdAndUpdate(
      id,
      {
        orderStatus: status,
        paymentIntent: {
          status: status,
        },
      },
      { new: true }
    );
    res.json(updateOrderStatus);
  } catch (error) {
    throw new Error(error);
  }
});

//get order by id

const getOrderByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const userorders = await Order.findOne({ orderby: id })
      .populate("products.product")
      .populate("orderby")
      .exec();
    res.json(userorders);
  } catch (error) {
    throw new Error(error);
  }
});

// hanlde successful login
const handleLoginSuccess = asyncHandler(async (req, res) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: "successfull",
      user: req.user,
    });
  }
});

//handle login failed
const handleLoginFailed = asyncHandler(async (req, res) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
});

// handleGoogleAuth
const handleGoogleAuth = asyncHandler(async (req, res) => {
  passport.authenticate("google", {
    scope: ["https://www.googleapis.com/auth/userinfo.email", "profile"],
  })(req, res);
});

//handleGoogleCallback
const handleGoogleCallback = asyncHandler(async (req, res) => {
  passport.authenticate("google", {
    successRedirect: CLIENT_URL,
    failureRedirect: "/login/failed",
  })(req, res);
});

module.exports = {
  createUser,
  loginUserCtrl,
  getallUser,
  getaUser,
  deletedUser,
  updatedUser,
  blockUser,
  unblockUser,
  handleRefreshToken,
  logout,
  updatePassword,
  forgotPasswordToken,
  resetPassword,
  getWishlist,
  saveAddress,
  addToCart,
  getUserCart,
  removeFromCart,
  emptyCart,
  applyCoupon,
  createOrder,
  deleteOrder,
  getOrders,
  getAllOrders,
  updateOrderStatus,
  getOrderByUserId,
  handleLoginSuccess,
  handleLoginFailed,
  handleGoogleAuth,
  handleGoogleCallback,
  updateCart,
};
