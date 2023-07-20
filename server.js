require("dotenv").config();

const fs = require("fs");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require('express-session');
const passport = require("passport");
const app = express();
const port = 3012;
const SamlStrategy = require("@node-saml/passport-saml").Strategy;
const certificatePath = path.join(__dirname, "/private/okta-v2.cert");
const certFile = fs.readFileSync(certificatePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading certificate file:", err);
    return;
  }
  return data;
});
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
  })
);
app.use((req,resp,next)=>{
  resp.header('Access-Control-Allow-Origin','*');
  resp.header('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept, Authorization');
  resp.header("Access-Control-Allow-Credentials", "true");
  if(req.method=='OPTIONS'){
    resp.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    resp.status(200).json({})
  }
  next();
});
app.use(express.urlencoded({ extended: false}));
app.use(express.json())

// Passport configuration
passport.use(
  new SamlStrategy(
    {
      path: process.env.CALLBACK_URL,
      audience: process.env.AUDIENCE,
      signatureAlgorithm: process.env.ALGORITHM,
      logoutUrl: process.env.LOGOUT_URL,
      entryPoint: process.env.ENTRY_POINT,
      issuer: process.env.ISSUER,
      protocol: "http://",
      cert: certFile, // cert must be provided
    },
    function (profile, done) {
      return done(null, profile);
    }
  )
);
// Serialize user to maintain a session (you might want to store user data in a database)
passport.serializeUser(function (user, done) {
  console.log("user", user);
  /* 
  user {
    issuer: 'http://www.okta.com/exkafrygz564566IeIlFmW456d64',
    inResponseTo: '_kfjjsdfe5015981025f464646462911237',
    sessionIndex: '_kfjjsdf15981025f46464564dc2911237',
    nameID: 'user@email.com',
    nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    nameQualifier: undefined,
    spNameQualifier: undefined,
    userID: 'user@email.com',
    attributes: { userID: 'user@email.com' },
    getAssertionXml: [Function (anonymous)],
    getAssertion: [Function (anonymous)],
    getSamlResponseXml: [Function (anonymous)]
  }
  */
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// Middleware to initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.get(
  "/login",
  passport.authenticate("saml", { failureRedirect: "/" }),
  function (req, res) {
    res.redirect("/dashboard");
  }
);

// Define the callback URL for the IdP to return the SAML response
app.post(
  "/login/callback",
  passport.authenticate("saml", {
    failureRedirect: "/",
    failureFlash:true
  }),
  function (req, res) {
    // Successful authentication, redirect to the desired page
    res.redirect("/dashboard");
  }
);

// Protected route (you can create middleware to check if the user is authenticated)
app.get("/dashboard", (req, res) => {
  if (req.isAuthenticated()) {
    res.send("Welcome to the dashboard!");
  } else {
    res.redirect("/login");
  }
});

// Logout route
app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    res.send(`Hello ${req.user.email}! You are logged in.`);
  } else {
    res.send('You are not logged in. <a href="/login">Login</a>');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log("certFile", certFile);
});