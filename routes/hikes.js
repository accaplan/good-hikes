const express = require("express");
const router = express.Router();
const { asyncHandler } = require("./utils");
const db = require("../db/models");
const { check, validationResult } = require('express-validator');
const { requireAuth } = require('../auth');


// Hikes page

// Get 1 specific hikes
router.get(
  "/:hikeId(\\d+)",
  asyncHandler(async (req, res) => {
    const hikeId = parseInt(req.params.hikeId, 10);
    const hike = await db.Hike.findByPk(hikeId, {
      include: [
        db.Tag,
        db.CityPark,
        db.State,
        db.Difficulty,
        db.RouteType,
      ],
    });

    //query for populating reviews section on /hikes/:hikeId page
    const reviews = await db.Review.findAll({
      where: { hikeId },
      include: [db.User],
      limit: 10,
      order: [["createdAt", "DESC"]]
    });

    //query for the bars on /hikes/:hikeId page
    const reviewsAll = await db.Review.findAll();

    //finding each rating percentage from all the ratings (for the bars)
    const avgRatingPercentage = [];
    for (let i = 1; i < 6; i++) {
      const ratingAmount = await db.Review.findAll({
        where: { rating: i }
      });
      let avg = ((ratingAmount.length / reviewsAll.length) * 100).toFixed(1) ;
      avgRatingPercentage.push(avg);
    }

    // console.log(avgRatingPercentage);

    let avgReview = 0;
    for (let review of reviews) {
      avgReview += review.rating;
    }
    avgReview = (avgReview / reviews.length).toFixed(1);
    let avgReviewPtg = (avgReview / 5) * 100;

    res.render("hike", {
      title: hike.name,
      hike,
      reviews,
      avgReview,
      avgReviewPtg,
      avgRatingPercentage
    });
  }));

//validation for the review form
const reviewValidators = [
  check('rating')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Rating'),
  check('dateHike')
    .custom(dateHike => {
      let today = new Date();
      let enteredDate = new Date(dateHike);
      if (enteredDate > today) {
        throw Error('Date of hike must be in the past');
      }
      return true;
    })
]

router.post('/:hikeId(\\d+)/reviews', requireAuth, reviewValidators, asyncHandler(async (req, res) => {

  let { hikeId, rating, comment, dateHike } = req.body;
  const userId = req.session.auth.userId;

  //if there is no comment (which is optional)
  //set comment to null and send request to the database
  if (!comment) {
    comment = null;
  }

  //if there is no dateHike (which is optional)
  //set date to null and send request to the database
  if (!dateHike) {
    dateHike = null;
  }

  //creating a review for the database
  const review = db.Review.build({
    userId,
    hikeId,
    rating,
    comment,
    dateHike
  });

  //checking if the input for the review is valid
  const validationErrors = validationResult(req);

  //find the owner of the review(the user)
  const user = await db.User.findOne({ where: { id: userId } });

  //if the review is valid, save it to the database
  if (validationErrors.isEmpty()) {
    await review.save();

    //response to the frontend page
    res.json({
      message: "Success",
      review,
      user
    });
  } else {
    //if review is not valid, send the errors to the frontend
    const errors = validationErrors.array().map(err => err.msg);

    //response to the frontend page,
    //including the errors, built reveiew(for prepopoulating the form),
    //and the user
    res.json({
      message: "Error",
      errors,
      review,
      user
    });
  }
}));

module.exports = router;
