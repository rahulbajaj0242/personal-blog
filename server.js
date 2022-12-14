var express = require('express');
var blogService = require('./blog-service');
var authData = require('./auth-service');
var path = require('path');
var app = express();

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const exphbs = require('express-handlebars');

const stripJs = require('strip-js');
const clientSessions = require('client-sessions');

app.use(function (req, res, next) {
  let route = req.path.substring(1);
  app.locals.activeRoute =
    route == '/' ? '/' : '/' + route.replace(/\/(.*)/, '');
  app.locals.viewingCategory = req.query.category;
  next();
});

app.engine(
  '.hbs',
  exphbs.engine({
    extname: '.hbs',
    helpers: {
      navLink: function (url, options) {
        return (
          '<li' +
          (url == app.locals.activeRoute ? ' class="active" ' : '') +
          '><a href="' +
          url +
          '">' +
          options.fn(this) +
          '</a></li>'
        );
      },

      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3)
          throw new Error('Handlebars Helper equal needs 2 parameters');
        if (lvalue != rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      },
      safeHTML: function (context) {
        return stripJs(context);
      },
      formatDate: function (dateObj) {
        let year = dateObj.getFullYear();
        let month = (dateObj.getMonth() + 1).toString();
        let day = dateObj.getDate().toString();
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      },
    },
  })
);
app.set('view engine', '.hbs');

app.use(
  clientSessions({
    cookieName: 'session',
    secret: 'WEB322-APP',
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60,
  })
);

var HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: 'dqtojvooi',
  api_key: '534642193571396',
  api_secret: 'l6E2pN_QzNSOkPnljAk6fUPrX8w',
  secure: true,
});

const upload = multer();

function onHttpStart() {
  console.log('Express http server listening on: ' + HTTP_PORT);
}

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
}

app.get('/', (req, res) => {
  res.redirect('/blog');
});

app.get('/about', (req, res) => {
  res.render('about', {
    layout: 'main',
  });
});

app.get('/login', (req, res) => {
  res.render('login', {
    layout: 'main',
  });
});

app.get('/logout', (req, res) => {
  req.session.reset();
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.render('register', {
    layout: 'main',
  });
});

app.get('/userHistory', ensureLogin, (req, res) => {
  res.render('userHistory', {
    layout: 'main',
  });
});

app.get('/blog', async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "post" objects
    let posts = [];

    // if there's a "category" query, filter the returned posts by category
    if (req.query.category) {
      // Obtain the published "posts" by category
      posts = await blogService.getPublishedPostsByCategory(req.query.category);
    } else {
      // Obtain the published "posts"
      posts = await blogService.getPublishedPosts();
    }

    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

    // get the latest post from the front of the list (element 0)
    let post = posts[0];

    // store the "posts" and "post" data in the viewData object (to be passed to the view)
    viewData.posts = posts;
    viewData.post = post;
  } catch (err) {
    viewData.message = 'no results';
  }

  try {
    // Obtain the full list of "categories"
    let categories = await blogService.getCategories();

    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = 'no results';
  }

  // render the "blog" view with all of the data (viewData)
  res.render('blog', { data: viewData });
});

app.get('/blog/:id', async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "post" objects
    let posts = [];

    // if there's a "category" query, filter the returned posts by category
    if (req.query.category) {
      // Obtain the published "posts" by category
      posts = await blogService.getPublishedPostsByCategory(req.query.category);
    } else {
      // Obtain the published "posts"
      posts = await blogService.getPublishedPosts();
    }

    // sort the published posts by postDate
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

    // store the "posts" and "post" data in the viewData object (to be passed to the view)
    viewData.posts = posts;
  } catch (err) {
    viewData.message = 'no results';
  }

  try {
    // Obtain the post by "id"
    viewData.post = await blogService.getPostById(req.params.id);
  } catch (err) {
    viewData.message = 'no results';
  }

  try {
    // Obtain the full list of "categories"
    let categories = await blogService.getCategories();

    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = 'no results';
  }

  // render the "blog" view with all of the data (viewData)
  res.render('blog', { data: viewData });
});

app.get('/categories', ensureLogin, (req, res) => {
  blogService
    .getCategories()
    .then((data) => {
      if (data.length > 0) res.render('categories', { categories: data });
      else res.render('categories', { message: 'no results' });
    })
    .catch((err) => {
      res.render('categories', { message: 'no results' });
    });
});

app.get('/posts/add', ensureLogin, (req, res) => {
  blogService
    .getCategories()
    .then((data) => {
      res.render('addPost', { categories: data, layout: 'main' });
    })
    .catch((err) => {
      res.render('addPost', { categories: [], layout: 'main' });
    });
});

app.get('/posts', ensureLogin, (req, res) => {
  if (req.query.category) {
    blogService
      .getPostsByCategory(req.query.category)
      .then((data) => {
        res.render('posts', { posts: data, layout: 'main' });
      })
      .catch((err) => {
        res.render('posts', { message: 'no results', layout: 'main' });
      });
  } else if (req.query.minDate) {
    blogService
      .getPostByMinDate(req.query.minDate)
      .then((data) => {
        if (data.length > 0) res.render('posts', { posts: data });
        else res.render('posts', { message: 'no results' });
      })
      .catch((err) => {
        res.render('posts', { message: 'no results' });
      });

    //if no query has been passes
  } else if (JSON.stringify(req.query) === JSON.stringify({})) {
    blogService
      .getAllPosts()
      .then((data) => {
        if (data.length > 0) res.render('posts', { posts: data });
        else res.render('posts', { message: 'no results' });
      })
      .catch((err) => {
        res.render('posts', { message: 'no results' });
      });

    //if wrong query name has been passed
  } else {
    res.status(404).send('Page Not Found');
  }
});

app.get('/post/:value', ensureLogin, (req, res) => {
  blogService
    .getPostById(req.params.value)
    .then((post) => {
      res.json(post);
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get('/categories/add', ensureLogin, (req, res) => {
  res.render('addCategory', {
    layout: 'main',
  });
});

app.get('/categories/delete/:id', ensureLogin, (req, res) => {
  blogService
    .deleteCategoryById(req.params.id)
    .then(() => {
      res.redirect('/categories');
    })
    .catch((err) => {
      res.status(500).send('Unable to Remove Category / Category not found');
    });
});

app.get('/posts/delete/:id', ensureLogin, (req, res) => {
  blogService
    .deletePostById(req.params.id)
    .then(() => {
      res.redirect('/posts');
    })
    .catch((err) => {
      res.status(500).send('Unable to Remove Post / Post not found');
    });
});

app.post(
  '/posts/add',
  ensureLogin,
  upload.single('featureImage'),
  (req, res) => {
    if (req.file) {
      let streamUpload = (req) => {
        return new Promise((resolve, reject) => {
          let stream = cloudinary.uploader.upload_stream((error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          });

          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };

      async function upload(req) {
        let result = await streamUpload(req);
        console.log(result);
        return result;
      }

      upload(req).then((uploaded) => {
        processPost(uploaded.url);
      });
    } else {
      processPost('');
    }

    function processPost(imageUrl) {
      req.body.featureImage = imageUrl;

      // TODO: Process the req.body and add it as a new Blog Post before redirecting to /posts
      blogService
        .addPost(req.body)
        .then((post) => {
          res.redirect('/posts');
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }
);

app.post('/categories/add', ensureLogin, (req, res) => {
  blogService
    .addCategory(req.body)
    .then((post) => {
      res.redirect('/categories');
    })
    .catch((err) => {
      console.log(err);
    });
});

app.post('/register', (req, res) => {
  authData
    .registerUser(req.body)
    .then((data) => {
      console.log(data);
      res.render('register', {
        layout: 'main',
        successMessage: 'User created',
      });
    })
    .catch((err) => {
      console.log(err);
      res.render('register', {
        errorMessage: err,
        userName: req.body.userName,
      });
    });
});

app.post('/login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');

  authData
    .checkUser(req.body)
    .then((user) => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory,
      };
      res.redirect('/posts');
    })
    .catch((err) => {
      res.render('login', {
        errorMessage: err,
        userName: req.body.userName,
      });
    });
});

app.use((req, res) => {
  res.status(404).send('Page Not Found');
});

blogService
  .initialize()
  .then(authData.initialize)
  .then(function () {
    app.listen(HTTP_PORT, function () {
      console.log('app listening on: ' + HTTP_PORT);
    });
  })
  .catch(function (err) {
    console.log('unable to start server: ' + err);
  });
