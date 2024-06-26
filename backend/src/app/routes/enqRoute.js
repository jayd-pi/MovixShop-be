const express = require("express");
const { authMiddleware, isAdmin } = require("../middleware/authMiddleware");
const {
    createEnqiry,
    updateEnqiry,
    deleteEnquiry,
    getEnqiry,
    getAllEnquiry
} = require("../controllers/enqController");
const router = express.Router();


router.post("/", authMiddleware, isAdmin, createEnqiry);
router.put("/:id", authMiddleware, isAdmin, updateEnqiry);
router.delete("/:id", authMiddleware, isAdmin, deleteEnquiry);
router.get("/:id", getEnqiry);
router.get("/", getAllEnquiry);


module.exports = router;