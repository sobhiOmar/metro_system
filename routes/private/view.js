const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  console.log('sessionToken is : ', sessionToken)
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }
  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();
  if (!user) {
    console.log('user not found')
  }
  console.log(user, 'user', sessionToken, 'sessionToken','user.id', user.id)
  user.user = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  return user;  
}
module.exports = function(app) {

  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) { 
    const user = await getUser(req);
    const role = user.roleid;
    if(role === 2){
      return res.render('dashboard', user);
    }else{ 
    return res.render('dashboarduser', user);
    }
    });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select('*').from('se_project.users');
    return res.render('users', { users });
  });
  

  // Register HTTP endpoint to render /courses page
  app.get('/stations', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('stations_example', { ...user, stations });
  });

  app.get('/password/reset', async function(req, res) {
    const user = await getUser(req);
    console.log('user is : ', user)
    console.log('user id is : ', user.id)
    return res.render('resetPassword', user);
  });


app.get('/manage/stations/:id', isAdmin, (req, res) => {
    const stationId = req.params.id;
    return res.render('manageStation', {stationId});
});

app.get('/create/stations', isAdmin, (req, res) => {
  return res.render('createStation');
});

app.get('/create/routes', isAdmin, (req, res) => {
  return res.render('createRoute');
});

app.get('/manage/routes/:id', isAdmin, async(req, res) => {
  const stationroutes=await stationinnerjoinroute()
  const routeId = req.params.id;
  return res.render('manageRoute', { routeId,stationroutes });
});


app.get('/get/stationroutesdata',isAdmin, async(req, res) => {
  const stationroutes=await stationinnerjoinroute()
  return res.render('stationroutes', { stationroutes });
})


app.get('/manage/requests/refunds', isAdmin,async (req, res) => {
  const refundRequests = await db('se_project.refund_requests')
    .where('status', 'pending');
    console.log('refundRequests are : ', refundRequests)
    res.render('manageRefunds', {refundRequests});
});


app.get('/manage/requests/refunds/:id', isAdmin,async (req, res) => {
  try {
    const refundRequests = await db('se_project.refund_requests')
    .where('status', 'pending');
    console.log('refundRequests are : ', refundRequests)
    res.render('manageRefund', {refundRequests});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while retrieving refund requests.' });
  }

});

app.get('/graph', async (req, res) => {
  try {
    const stations = await db('se_project.stations')
    const routes = await stationinnerjoinroute();
    res.render('graph', { stations: JSON.stringify(stations), routes: JSON.stringify(routes) });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/manage/routes', isAdmin,async (req, res) => {
  try {
    const routes = await stationinnerjoinroute();
    res.render('manageRoutes', {routes});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while retrieving routes.' });
  }

});


app.get('/manage/requests/seniors', isAdmin,async (req, res) => {
  try {
    const seniorRequests = await db('se_project.senior_requests')
    .where('status', 'pending');
    console.log('seniorRequests are : ', seniorRequests)
    res.render('manageSeniorRequests', { seniorRequests});
  }
    catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while retrieving senior requests.' });
    }
});



app.get('/manage/stations', isAdmin,async (req, res) => {
  const stations = await db.select('*').from('se_project.stations');
  console.log('stations are : ', stations)
  try {
    res.render('manageStations', {stations});} 
    catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while retrieving stations.' });
    }
})

app.get('/manage/zones', isAdmin,async (req, res) => {
  res.render('manageZones');
});


app.get('/manage/zones/:id', isAdmin,async (req, res) => {
const zones = await db.select('*').from('se_project.zones');
console.log('zones are : ', zones)
try {
  res.render('manageZone', {zones});} 
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while retrieving zones.' });
  }

});

app.get('/subscriptions', async function(req, res) {
  const user = await getUser(req);
  const userid = user.userid;
  const subs = await db.select('*').from('se_project.subsription').where("userid" , userid);
  return res.render('allSub', { ...user , subs});
});
app.get('/subscriptions/purchase', async function(req, res) {
  const user = await getUser(req);
  return res.render('subData', { ...user });
});
app.get('/payment/subscription', async function(req, res) {
  const user = await getUser(req);
  return res.render('subscription', { ...user });
});
app.get('/tickets', async function(req, res) {
  const user = await getUser(req);
  const userid = user.userid;
  const ticks = await db.select('*').from('se_project.tickets').where("userid" , userid);
  return res.render('tickets', { ...user , ticks });
});
app.get('/tickets/purchase', async function(req, res) {
  const user = await getUser(req);
  return res.render('Ptickets', { ...user });
});
app.get('/payment/ticket', async function(req, res) {
  const user = await getUser(req);
  return res.render('ticket', { ...user });
});
app.get('/tickets/purchase/subscription', async function(req, res) {
  const user = await getUser(req);
  return res.render('subTicket', { ...user });
});
app.get('/senior/request', async function(req, res) {
  const user = await getUser(req);
  return res.render('requestS', { ...user });
});
app.get('/prices', async function(req, res) {
  const user = await getUser(req);
  return res.render('price', { ...user });
});
app.get('/zones', async function(req, res) {
  const user = await getUser(req);
  const zones = await db.select('*').from('se_project.zones');
  return res.render('zone', { ...user , zones });
});
app.get('/requests/refund', async function(req, res) {
  const user = await getUser(req);
  const userid = user.userid;
  const rr = await db.select('*').from('se_project.refund_requests').where("userid" , userid);
  return res.render('requestRefund', { ...user , rr });
});
app.get('/rides', async function(req, res) {
  const user = await getUser(req);
  return res.render('ride', { ...user });
});
app.get('/rides/simulate', async function(req, res) {
  const user = await getUser(req);
  return res.render('simulateRide', { ...user });
});

async function stationinnerjoinroute() {
  const stationroutes = await db
  .select(
    'routes.id AS routeId',
    'routes.routename',
    'fromstation.id AS fromStationId',
    'fromstation.stationname AS fromStationName',
    'fromstation.stationposition AS fromStationPosition',
    'tostation.id AS toStationId',
    'tostation.stationname AS toStationName',
    'tostation.stationposition AS toStationPosition',
    db.raw("CASE WHEN fromstation.stationposition IN ('start', 'end') OR tostation.stationposition IN ('start', 'end') THEN 'yes' ELSE 'no' END AS canbedeleted")
  )
  .from('se_project.routes')
  .innerJoin(
    'se_project.stations AS fromstation',
    'routes.fromstationid',
    'fromstation.id'
  )
  .innerJoin(
    'se_project.stations AS tostation',
    'routes.tostationid',
    'tostation.id'
  );
  return stationroutes;
}

async function isAdmin(req, res, next) {
  try {
    const user = await getUser(req);
    const userRole = user.roleid;
    if (userRole == 2) { // 2 is the admin role
      console.log('user is admin');
      return next();
    } else {
      console.log('user is not admin');
      res.status(403).send('Access denied');
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).send('Internal server error');
  }
}
};