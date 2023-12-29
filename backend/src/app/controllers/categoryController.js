const Category = require("../models/categoryModel")
const asyncHandler = require("express-async-handler");
// const validateMongoDbId = require("../utils/validateMongodbId");


//create a new category
const createCategory = asyncHandler(async(req, res) => {
    try{
        const createCategory = await Category.create(req.body);
        res.json(createCategory);
    } catch(error){
        throw new Error(error);
    }
})

module.exports = {
    createCategory 
}