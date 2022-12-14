const express = require("express");
const dayjs = require("dayjs");
const striptags = require("striptags");
const router = express.Router();
const firebaseDB = require("../connections/firebase_admin");
const categoriesRef = firebaseDB.collection("categories");
const articlesRef = firebaseDB.collection("articles");
require('dotenv').config()

router.use(function(req, res, next) {
  // 只有 mandy@gmail.com 帳戶能用
  if (req.session.uid === process.env.USER_UID) {
    next()
  } else {
    res.redirect('/member/signin')
  }
})

// 後台首頁
router.get("/", function (req, res, next) {
  const path = req.originalUrl;
  const hasMemberId = req.session.uid;
  const memberName = req.session.nickname;

  res.render('dashboard/index', {
    title: "六角部落格|首頁",
    path,
    hasMemberId,
    memberName,
  })
});

// 分類管理
router.get("/categories", function (req, res, next) {
  const path = req.originalUrl;
  const messages = req.flash("info");
  const hasMemberId = req.session.uid;
  const memberName = req.session.nickname;

  categoriesRef.get().then((snapshot) => {
    let categoriesData = [];
    snapshot.forEach((doc) => categoriesData.push(doc.data()));

    res.render("dashboard/categories", {
      title: "六角部落格|分類管理",
      path,
      hasMemberId,
      memberName,
      categoriesData,
      messages,
      hasMessages: messages.length > 0,
    });
  });
});
router.post("/categories/create", function (req, res, next) {
  const data = req.body;

  categoriesRef
    .where("path", "==", data.path)
    .get()
    .then((snapshot) => {
      let paths = [];
      snapshot.forEach((doc) => paths.push(doc.data().path));

      if (paths.length > 0) {
        req.flash("info", "已有相同路徑");
        res.redirect("/dashboard/categories");
      } else {
        let categoryRef = categoriesRef.doc();
        data.id = categoryRef.id; // 事先取得 id

        return categoryRef.set(data);
      }
    })
    .then(() => {
      res.redirect("/dashboard/categories");
      console.log("成功");
    });
});
router.post("/categories/delete/:id", function (req, res, next) {
  const id = req.params["id"];

  categoriesRef
    .get()
    .then((snapshot) => {
      let categoriesInfo = [];
      snapshot.forEach((doc) => {
        categoriesInfo.push(doc.data());
      });
      const categoryName = categoriesInfo.filter(category=>category.id ===id)[0]?.name
      return articlesRef.where('category','==',categoryName).get()
    })
    .then((snapshot)=>{
      let articlesInfo = [];
      snapshot.forEach(doc =>{
        articlesInfo.push(doc.data())
      })
      if(articlesInfo.length > 0){
        articlesInfo.forEach(article =>{
          articlesRef.doc(article.id).update({
            category: '沒有分類',
            status: 'draft',
          })
        })
      }
      return categoriesRef.doc(id).delete()
    })
    .then(() => {
      req.flash("info", "欄位已刪除");
      res.redirect("/dashboard/categories");
    });
});

// 文章管理
router.get("/archives", function (req, res, next) {
  const path = req.originalUrl;
  const state = req.query.state || "public";
  let categoriesInfo = [];
  const hasMemberId = req.session.uid;
  const memberName = req.session.nickname;

  categoriesRef
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        categoriesInfo.push(doc.data());
      });
      return articlesRef.orderBy("update_time").get();
    })
    .then((snapshot) => {
      let articlesInfo = [];
      snapshot.forEach((doc) => {
        if (doc.data()?.status === state) {
          articlesInfo.push(doc.data());
        }
      });
      articlesInfo.reverse(); // 反轉 最新文章在上方

      res.render("dashboard/archives", {
        title: "六角部落格|文章管理",
        path,
        hasMemberId,
        memberName,
        articlesInfo,
        categoriesInfo,
        dayjs,
        striptags,
        state,
      });
    });
});
router.post("/archives/delete/:id", function (req, res, next) {
  const id = req.params["id"];
  articlesRef
    .doc(id)
    .delete()
    .then(() => {
      res.send("文章已刪除");
      res.end(); // 結束回應
    });
});

// 文章建立
router
  .route("/article/create")
  .get(function (req, res, next) {
    const path = req.originalUrl;
    const hasMemberId = req.session.uid;
    const memberName = req.session.nickname;

    categoriesRef.get().then((snapshot) => {
      let categoriesInfo = [];
      let articleInfo = {};

      snapshot.forEach((doc) => categoriesInfo.push(doc.data()));
      res.render("dashboard/article", {
        title: "六角部落格|文章編輯",
        path,
        hasMemberId,
        memberName,
        categoriesInfo,
        articleInfo,
      });
    });
  })
  .post(function (req, res, next) {
    let data = req.body;
    const articleRef = articlesRef.doc();
    const id = articleRef.id;
    const update_time = dayjs().toJSON();
    data.id = id;
    data.update_time = update_time;

    articleRef.set(data).then(() => {
      res.redirect(`/dashboard/article/${id}`);
    });
  });

router.get("/article/:id", function (req, res, next) {
  const path = req.originalUrl;
  const id = req.params.id;
  const hasMemberId = req.session.uid;
  const memberName = req.session.nickname;

  let articleInfo = {};
  articlesRef
    .doc(id)
    .get()
    .then((doc) => {
      articleInfo = doc.data();
      return categoriesRef.get();
    })
    .then((snapshot) => {
      let categoriesInfo = [];
      snapshot.forEach((doc) => categoriesInfo.push(doc.data()));

      res.render("dashboard/article", {
        title: "六角部落格|文章編輯",
        path,
        hasMemberId,
        memberName,
        categoriesInfo,
        articleInfo,
      });
    });
});

router.post("/article/update/:id", function (req, res, next) {
  const id = req.params.id;
  const data = req.body;
  const update_time = dayjs().toJSON();
  data.id = id;
  data.update_time = update_time;

  articlesRef
    .doc(id)
    .update(data)
    .then(() => {
      res.redirect(`/dashboard/article/${id}`);
    });
});
module.exports = router;
