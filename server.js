const express = require('express');
const bodyParser = require('body-parser');
const multipart = require('connect-multiparty');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const multipartMiddleware = multipart();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3128;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'waronow123@gmail.com',
    pass: 'Tucson@19'
  }
});

const app = express();
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('appSecret', 'secretforinvoiceapp');

app.get('/', function(req, res) {
  res.send("Welcome to the Invoice App");
});

app.post('/register', multipartMiddleware, function(req, res) {
  bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    let db = new sqlite3.Database("./database/InvoiceApp.db");
    let sql = `INSERT INTO users(name, email, phone, company_name, company_address, company_city, company_state, company_zip, password) VALUES ('${req.body.name}','${req.body.email}','${req.body.phone}','${req.body.company_name}','${req.body.company_address}','${req.body.company_city}','${req.body.company_state}','${req.body.company_zip}','${hash}')`;
    db.run(sql, function(err) {
      if (err) {
        throw err;
      } else {
        let user_id = this.lastID;
        let query = `SELECT * FROM users WHERE id='${user_id}'`;
        db.all(query, [], (err, rows) => {
          if (err) {
            throw err;
          }
          let user = rows[0];
          delete user.password;
          const payload = {
            user: user
          };
          let token = jwt.sign(payload, app.get('appSecret'), {
            expiresIn: "8h"
          });
          return res.json({
            status: true,
            user: user,
            token : token
          });
        });
      }
    });
    db.close();
  });
});

app.post("/login", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `SELECT * from users WHERE email='${req.body.email}'`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    db.close();
    if (rows.length === 0) {
      return res.json({
        status: false,
        message: "Sorry, wrong email"
      });
    }
    let user = rows[0];
    let authenticated = bcrypt.compareSync(req.body.password, user.password);
    delete user.password;
    if (authenticated) {
      const payload = { user: user };
      let token = jwt.sign(payload, app.get('appSecret'), {
        expiresIn: "8h"
      });
      return res.json({
        status: true,
        user: user,
        token: token
      });
    }
    return res.json({
      status: false,
      message: "Wrong Password, try again"
    });
  });
});

app.use(function(req, res, next) {
  let token = req.body.token || req.query.token || req.headers["x-access-token"];

  if (token) {
    jwt.verify(token, app.get('appSecret'), function(err, decoded) {
      if (err) {
        return res.json({
          success: false,
          message: "Failed to authenticate token"
        });
      } else {
        req.decoded = decoded;
        next()
      }
    });
  } else {
    return res.status(403).send({
      succes: false,
      message: "No token provided"
    });
  }
});

app.get("/invoice/user/:user_id", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `SELECT * FROM invoices WHERE user_id='${req.params.user_id}'`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    return res.json({
      status: true,
      invoices: rows
    });
  });
});

app.get("/invoice/user/:user_id/:invoice_id", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `SELECT * FROM invoices WHERE user_id='${req.params.user_id}' AND id='${req.params.invoice_id}'`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    let invoice = rows[0]
    let fetchInvoice = `SELECT * FROM transactions WHERE invoice_id='${req.params.invoice_id}'`
    db.all(fetchInvoice, [], (err, rows) => {
      if (err) {
        throw err;
      }
      return res.json({
        status: true,
        invoice: invoice,
        transactions: rows
      })
    });
  });
});

app.get("/business/user/:user_id", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `SELECT * FROM business where user_id=${req.params.user_id}`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    return res.json({
      status: true,
      business: rows
    });
  });
});

app.get("/employee/user/:user_id", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `SELECT * FROM employee where user_id=${req.params.user_id}`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    return res.json({
      status: true,
      employee: rows
    });
  });
});

app.post("/invoice", multipartMiddleware, function(req, res) {
  let item = req.body.item_id.split(",");
  let descrip = req.body.description.split(",");
  let quan = req.body.quantity.split(",");
  let cost = req.body.price.split(",");
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `INSERT INTO invoices(name, user_id, paid, total_price, created) VALUES('${req.body.name}','${req.body.user_id}','${req.body.paid}','${req.body.total_price}',datetime('now', 'localtime'))`;
  db.serialize(function() {
    db.run(sql, function(err) {
      if (err) {
        return res.json({
          status: false,
          message: "There was an error creating invoice!"
        });
      }
      let invoice_id = this.lastID;
      for (let i = 0; i < descrip.length; i++) {
        let query = `INSERT INTO transactions(item_id, description, quantity, price, invoice_id) VALUES('${item[i]}','${descrip[i]}','${quan[i]}','${cost[i]}',${invoice_id})`;
        db.run(query, function(err) {
          if (err) {
            error = true;
            return res.json({
              status: false,
              message: "There was an error creating invoice!"
            });
          }
        });
      }
      return res.json({
        status: true,
        message: "Invoice Created"
      });
    });
  });
});

app.post("/business", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `INSERT INTO business(business_name, business_contact, business_email, business_phone, business_address, business_city, business_state, business_zip, user_id) VALUES('${req.body.business_name}','${req.body.business_contact}','${req.body.business_email}','${req.body.business_phone}','${req.body.business_address}','${req.body.business_city}','${req.body.business_state}','${req.body.business_zip}','${req.body.user_id}')`;
  db.run(sql, function(err) {
    if (err) {
      return res.json({
        status: false,
        message: "Error Saving Business"
      });
    }
    return res.json({
      status: true,
      message: "New Business Created"
    });
  });
});

app.post("/employee", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `INSERT INTO employee(name, phone, email, address, city, state, zip, state_tax, fed_tax, user_id) VALUES('${req.body.name}','${req.body.phone}','${req.body.email}','${req.body.address}','${req.body.city}','${req.body.state}','${req.body.zip}','${req.body.fed_tax}','${req.body.state_tax}','${req.body.user_id}')`;
  db.run(sql, function(err) {
    if (err) {
      return res.json({
        status: false,
        message: "Error Saving Employee"
      });
    }
    return res.json({
      status: true,
      message: "New Employee Created"
    });
  });
});

app.post("/sendmail", multipartMiddleware, function(req, res) {
  let sender = JSON.parse(req.body.user);
  let recipient = JSON.parse(req.body.recipient);
  let mailOptions = {
    from: "waronow123@gmail.com",
    to: recipient.email,
    subject: `Hello, ${recipient.name}.  Here is an invoice from ${sender.company_name}`,
    text: `You owe ${sender.company_name}`
  };
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      return res.json({
        status: false,
        message: `Error emailing to ${recipient.name}`
      });
    } else {
      return res.json({
        status: true,
        message: `Invoice emailed to ${recipient.name}`
      });
    }
  });
});

app.patch("/invoice", multipartMiddleware, function(req, res) {
  let db = new sqlite3.Database("./database/InvoiceApp.db");
  let sql = `UPDATE invoices SET paid='${req.body.paid}', updated=datetime('now', 'localtime') WHERE id='${req.body.id}'`;
  db.run(sql, function(err) {
    if (err) {
      console.log(err)
      return res.json({
        status: false,
        message: "Error Adding Payment"
      });
    }
    return res.json({
      status: true,
      message: "Payment Applied"
    });
  });
  db.close()
});

app.listen(PORT, function() {
  console.log(`App running on localhost:${PORT}`);
});
