const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const constants = require("../constants");

const {
  validateEmail,
  validatePhoneNumber,
  isValidDate,
} = require("../utils/validators");

// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: validateEmail,
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: validatePhoneNumber,
        message: (props) =>
          `${props.value} is not a valid phone number! Must be 9-11 digits positive number.`,
      },
    },
    password: {
      type: String,
      // required: true,
    },
    birthday: {
      type: String,
      validate: {
        validator: isValidDate,
        message: (props) =>
          `${props.value} is not a valid date. Use the format YYYY-MM-DD.`,
      },
    },
    role: {
      type: String,
      enum: Object.values(constants.USER.ROLE),
      default: constants.USER.ROLE.CUSTOMER,
      required: true,
    },
    gender: {
      type: String,
      trim: true,
      enum: Object.values(constants.USER.GENDER),
      default: constants.USER.GENDER.OTHER,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    cart: {
      type: Array,
      default: [],
    },
    address: {
      type: String,
    },
    avatar: { type: String, trim: true, required: false },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    refreshToken: {
      type: String,
    },
    passwordChangeAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

//bcrypt password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSaltSync(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.isPasswordMatched = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.methods.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000;
  return resetToken;
};

//Export the model
module.exports = mongoose.model("User", userSchema);
