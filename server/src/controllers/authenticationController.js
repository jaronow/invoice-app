const {Company} = require('../../models');
const {User} = require('../../models');
const {Employee} = require('../../models');
const {Tax} = require('../../models');
const jwt = require('jsonwebtoken');
const config = require('../../config/config.json');

function jwtSignUser (user) {
  return jwt.sign(user, config.development.authentication.jwtSecret, {
    expiresIn: "1hr"
  })
}

module.exports = {
  async register (req, res) {
    try {
      const company = await Company.create({
        company_name: req.body.company_name,
        company_phone: req.body.company_phone,
        company_email: req.body.company_email,
        company_address: req.body.company_address,
        company_city: req.body.company_city,
        company_state: req.body.company_state,
        company_zip: req.body.company_zip,
        company_ein: req.body.company_ein
      })
      let user = await User.create({
        name: req.body.name,
        title: req.body.title,
        phone: req.body.phone,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
        companyId: company.id
      })
      const employee = await Employee.create({
        employeeId: user.id
      })
      await Tax.create({
        taxId: employee.id
      })
      user = await User.findOne({
        where: {
          email: req.body.email
        },
        include: [
        {
          model: Employee,
          as: 'employeeId',
          include: [
            {
              model: Tax,
              as: 'taxId'
            }
          ]
        }
      ]
      })
      delete user.dataValues.password
      let payload ={user: user, company: company}
      let token = jwtSignUser(payload)
      res.status(201).json({
        status: true,
        company: company,
        user: user,
        token: 'Bearer ' + token
      })
    } catch (err) {
      console.log(err)
      res.status(409).json({
        error: `${req.body.email} or ${req.body.company_name} is already in use!`
      })
    }
  },
  async login (req, res) {
    try {
      const {email, password} = req.body
      const user = await User.findOne({
        where: {
          email: email
        },
        include: [
        {
          model: Employee,
          as: 'employeeId',
          include: [
            {
              model: Tax,
              as: 'taxId'
            }
          ]
        }
      ]
      })
      const isPasswordValid = await user.comparePassword(password)
      delete user.dataValues.password
      if (!user || !isPasswordValid) {
        return res.status(404).json({
          error: 'Incorrect login credentials'
        })
      }
      const company = await Company.findOne({
        where: {
          id: user.companyId
        }
      })
      let payload ={user: user, company: company}
      let token = jwtSignUser(payload)
      res.status(201).json({
        status: true,
        company: company,
        user: user,
        token: 'Bearer ' + token
      })
    } catch (err) {
      res.status(500).json({
        error: 'Oops, our server had an issue, try again.'
      })
    }
  }
};
