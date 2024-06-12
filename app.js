const express = require('express')
const app = express()
app.use(express.json())

const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server started on local host:3000')
    })
  } catch (e) {
    console.log(`Unable to start the server :${e.message}`)
  }
}
initializeServer()

const authentication = async (request, response, next) => {
  let jwtToken
  let jwtheader = request.headers['authorization']
  if (jwtheader !== undefined) {
    jwtToken = jwtheader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'Secrect_key', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//LOGIN

app.post('/login/', async (request, response) => {
  let {username, password} = request.body
  let getUserQuery = `SELECT * FROM user WHERE username='${username}'; `

  let user = await db.get(getUserQuery)
  //response.send(user)
  if (user === undefined) {
    console.log('user')
    response.status(400)
    response.send('Invalid user')
  } else {
    let passwordQuery = await bcrypt.compare(password, user.password)
    if (passwordQuery == true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'Secrect_key')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET STATES

app.get('/states/', authentication, async (request, response) => {
  const statesQuery = `SELECT * FROM state`
  const statesfn = statesList => {
    return {
      stateId: statesList.state_id,
      stateName: statesList.state_name,
      population: statesList.population,
    }
  }
  const statesList = await db.all(statesQuery)
  response.send(statesList.map(state => statesfn(state)))
})

//GET STATE

app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const stateQuery = `SELECT * FROM state WHERE state_id=${stateId};`
  const statesfn = statesList => {
    return {
      stateId: statesList.state_id,
      stateName: statesList.state_name,
      population: statesList.population,
    }
  }
  const stateList = await db.get(stateQuery)
  response.send(statesfn(stateList))
})

//POST DISTRICT

app.post('/districts/', authentication, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const districtAddQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
  `
  await db.run(districtAddQuery)
  response.send('District Successfully Added')
})

//GET DISTRICT

app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const districtQuery = `SELECT * FROM district WHERE district_id=${districtId};`
    const distfn = district => {
      return {
        districtId: district.district_id,
        districtName: district.district_name,
        stateId: district.state_id,
        cases: district.cases,
        cured: district.cured,
        active: district.active,
        deaths: district.deaths,
      }
    }
    const district = await db.get(districtQuery)
    response.send(distfn(district))
  },
)
//Delte dist
app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId}`
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

// UPDATE DIST

app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const districtUpdateQuery = `UPDATE  district
   SET
   district_name='${districtName}', 
   state_id = ${stateId},
   cases = ${cases}, 
   cured = ${cured},
   active= ${active}, 
   deaths = ${deaths}
   WHERE district_id=${districtId} ;`

    await db.run(districtUpdateQuery)

    response.send('District Details Updated')
  },
)

//GET stats

app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `SELECT sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths From district WHERE state_id=${stateId} GROUP BY state_id;`
    const stats = await db.get(statsQuery)
    response.send(stats)
  },
)

module.exports = app
