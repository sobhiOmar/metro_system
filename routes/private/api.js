const { isEmpty, update, get, create, map } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const {getSessionToken}=require('../../utils/session');
const e = require("express");
const axios = require('axios');


const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi",sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
   .first();
  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  return user;
};


module.exports = function (app) {
  app.get("/users", async function (req, res) {
    try {
       const user = await getUser(req);
      const users = await db.select('*').from("se_project.users")
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
   
  });


  app.put("/password/reset", async function (req, res) {
    console.log("hi from reset password api");
    const sessionToken = getSessionToken(req);
    try{
      const user = await getUser(req);
      const new_password = req.body.newPassword;// html file 
      console.log('user id ',user.id);
      let upated= await updatePassword(user.userid,new_password); 
      if(upated==='successfull'){
        return res.status(200).send("Password updated successfully");
      }
    }
    catch(e){
      console.log(e.message);
      return res.status(400).send("Could not reset password");
    }
  });



  app.post("/api/v1/station", async function (req, res) {  
    const {stationname,stationtype,stationposition,stationstatus}=req.body;
    if(chekIfExists(stationname,'se_project.stations')==true){
      return res.status(400).send("Station already exists");
    }
    try {
      const user = await getUser(req);
      if (!user.roleid === 2) {
        return res.status(401).send("Unauthorized");
      }
      else{
        insertIntoTable([{stationname,stationtype,stationposition,stationstatus}],'se_project.stations');
        return res.status(200).send("Stations created successfully");
      }
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not create stations");
    }
  });


//update station
  app.put("/manage/stations/:id", async function (req, res) {  //may needs testing
    const {idd}=req.body;
    const {stationname,stationtype,stationposition,stationstatus}=req.body;
    try{
      let upated= await updateStation(idd,stationname, stationtype, stationposition, stationstatus); 
      if(upated==='successful'){
        return res
        .status(200)
        .send("station updated successfully");
      }}
    catch(e){
      console.log(e.message);
      return res.status(400).send("Could not update station");
    }
  });


//delete station
  app.delete("/manage/stations/:id", async function (req, res) { 
    let idd = await req.params.id;
    console.log('trying to delete station ',idd);
    const position= await IsStartOrEndStation(idd)
    let Istransfer= await  isTransfer(idd);
    console.log('is it a transfer station ? ', Istransfer);
    try{
      console.log('is it a start or end station ? ', position);

      if(position=='start'|| position=='end'){
        console.log('start or end station');
        await delteStartOrEndStation(idd);
      }
      if(position=='middle'){
        console.log('middle station');
        await DeleteMiddelStation(idd);
      }else
      deleteStationRow(idd);
      return res.status(200).send("station deleted successfully");
    }catch(e){
      console.log(e.message);
      return res.status(400).send("Could not delete station ",position," station end or start");
    }
  });

//create a new route
app.post("/api/v1/route", async function (req, res) {       //works for all casses !! 
  console.log('hi from create route');
  const {routename,newstationid,connectedstationid}=req.body;
  console.log('route is:  ',routename,newstationid,connectedstationid);

  const check2 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", connectedstationid)
  .first();
  console.log(check2);

  const check1 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", newstationid)
  .first();
  console.log(check1);

  fromstationid=check2['id'];
  tostationid=check1['id'];
  console.log('from station id ',fromstationid);
  console.log('to station id ',tostationid);
  try {
    console.log('does the route name already exist ? ', await chekIfExists(routename,'se_project.routes'));
    if(( await chekIfExists(routename,'se_project.routes'))==true){
      console.log('route already exists');
      return res.status(400).send("route already exists");
    }

      let new_route_id =await insertIntoTable([{routename,tostationid,fromstationid}],'se_project.routes');
      console.log('new route id',new_route_id);
     // editStationPosition(new_route_id);
      await updatedStationpositionAndType(fromstationid);  
      await updatedStationpositionAndType(tostationid);  
      makeStationRoutes(fromstationid,tostationid,new_route_id);

      return res.status(200).send("route created successfully");
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("Could not create route");
  }
});

//check if exist //needs testing
app.put("/manage/routes/:id", async function (req, res) {                 
  console.log('hi from update route');
  const idd=req.body.routeid;
  const {routename,fromstationid,tostationid}=req.body;
  try{
    const data=await getToAndFrom(idd);
    const routeData = data[0]; 
    console.log('route data ->',routeData);
    const {fromstationidd,tostationidd} = routeData;
    let upated= await updateRoute(idd,routename,fromstationid,tostationid); 
    if(upated==='successful'){
      await updatedStationpositionAndType(fromstationidd);
      await updatedStationpositionAndType(tostationidd);
      return res.status(200).send("route updated successfully");
    }}

  catch(e){
    console.log(e.message);
    return res.status(400).send("Could not update station");
  }
});
//api/v1/route/:routeId
// old   /api/v1/requests/refunds/:requestId 
app.delete("/api/v1/route/:requestId",async(req, res)=> {                // works fine 
  const idd=req.params.requestId;
  const canbedeleted= await routeCanBeDeleted(idd);
  console.log('trying to delete route ',idd);
  console.log('can be deleted ? ',canbedeleted);

  const data=await getToAndFrom(idd);
  const routeData = data[0]; 
  console.log('route data',routeData);
  const {fromstationid,tostationid} = routeData;

  console.log('is it a start or end station ? ', await IsStartOrEndStation(fromstationid));
  console.log('is it a start or end station ? ', await IsStartOrEndStation(tostationid));

if(canbedeleted===true){
  try{
    await deleteRoute(idd);
    await updatedStationpositionAndType(fromstationid);
    await updatedStationpositionAndType(tostationid);
    return res.status(200).send("route deleted successfully");
}catch(e){
    console.log(e.message);
    return res.status(400).send("Could not delete route");
  }
}else{
  console.log('route is not start nor end');
  res.status(400).send(" route is not start nor end");
}
});


app.put('/api/v1/requests/refunds/:requestId', async (req, res) => {
  const idd=req.params.requestId;
  // const { idd } = req.body;
  const {status}=req.body;
  console.log('status is  : ',status);
  try {
    if(status=="Accepted"){
      await db('se_project.refund_requests')
      .where({ id: idd })
      .update({status: 'Accepted' });
      return res.status(200).send("refund request updated successfully");
    }
    if(status=="Rejected"){
      await db('se_project.refund_requests')
      .where({ id: idd })
      .update({ status: 'Rejected' });
      return res.status(200).send("refund request updated successfully");
    }
    else{
      return res.status(400).send("Could not update refund request");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred while updating the refund request.' });
  }
});
app.get("/api/v1/zone", async function (req, res) {
  try {
    console.log('hi from get zone');
    const zone = await db
    .select("*")
    .from("se_project.zones");
    return res.status(200).send(zone);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("error");
}

});


app.put('/api/v1/requests/senior/:requestId', async (req, res) => {
  const idd  = req.params.requestId;
  const {status}=req.body;
  console.log('status is  : ',status);
  try {
    if(status=="Accepted"){
      await db('se_project.senior_requests')
      .where({ id: idd })
      .update({status: 'Accepted' });
      return res.status(200).send("Seneior request updated successfully");
    }
    if(status=="Rejected"){
      await db('se_project.senior_requests')
      .where({ id: idd })
      .update({ status: 'Rejected' });
      return res.status(200).send("Seneior request updated successfully");
    }
    else{
      return res.status(400).send("Could not update Seneior request");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred while updating the Seneior request.' });
  }
});


app.put('/api/v1/zones/:zoneId', async (req, res) => {
  const idd = req.params.zoneId;
  console.log(req.body);
  const newprice=await req.body.price;
  console.log('new price is  : ',newprice);
  try {
    await db('se_project.zones')
    .where({ id: idd })
    .update({ price: newprice });
    return res.status(200).send("zone price updated successfully");
  }catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'An error occurred while updating the zone price .' });
  }
});

app.post("/api/v1/payment/subscription", async function (req, res) {
  const user = await getUser(req);
  const subtype = req.body.subtype;
  var nooftickets = 0;
  
  const check = await db
    .select("*")
    .from("se_project.subsription")
    .where("userid", user.userid)
    .first();
 
  if(check){
    if(check.nooftickets != 0 ){
      return res.status(400).send("you are already a subscriber");
    }
  }
  

  if(subtype == "month"){
    nooftickets += 10;
  }else if(subtype == "annual"){
    nooftickets += 100;
  }else if(subtype == "quarterly"){
    nooftickets += 50;
  }


  const iS = {
    subtype,
    zoneid:req.body.zoneid,
    userid:user.userid,
    nooftickets,
  };

try {
  const subS = await db("se_project.subsription").insert(iS).returning("*");
  const x = subS[0];

  const iT = {
    amount:req.body.amount,
    purchasedid:x.id,
    userid:user.userid
  };
  const subT = await db("se_project.transactions").insert(iT);
  
  nooftickets = 0;

  return res.status(200).json(subT);
} catch (e) {
  console.log(e.message);
  return res.status(400).send("error");
}

});

app.post("/api/v1/payment/ticket", async function (req, res) {
  const user = await getUser(req);
  const origin = req.body.origin;
  const destination = req.body.destination;
  const iC = {
    origin,
    destination,
    tripdate:req.body.tripdate,
    userid:user.userid
  }

  const check = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", origin)
  .first();

  const check2 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", destination)
  .first();

if(isEmpty(check) || isEmpty(check2)){
    return res.status(400).send("wrong station");
}


  const tickC = await db("se_project.tickets").insert(iC).returning("*");
  const x = tickC[0];


  const iT = {
    amount:req.body.amount,
    purchasedid:x.id,
    userid:user.userid
  };  
  
  try {
    const tickT = await db("se_project.transactions").insert(iT);
    

    return res.status(200).json( tickT);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("error");
  }

});

app.post("/api/v1/tickets/purchase/subscription", async function (req, res) {
  const user = await getUser(req);
  const userid = user.userid;
  const origin = req.body.origin;
  const destination = req.body.destination;
  
  const check = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", origin)
  .first();

  const check2 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", destination)
  .first();
  
  if(isEmpty(check) || isEmpty(check2)){
    return res.status(400).send("wrong station");
  }

  var noofticket = await db
  .select("*")
  .from("se_project.subsription")
  .where("userid", userid).first();

  var nooftickets =  noofticket.nooftickets;
  
  if(nooftickets == 0){
    return res.status(400).send("go and subscribe or pay online");
  }

  const iC = {
    origin:req.body.origin,
    destination:req.body.destination,
    tripdate:req.body.tripdate,
    userid,
    subid:noofticket.subid,
  }

  try {
  
    const tickC = await db("se_project.tickets").insert(iC);
    nooftickets--;
    const deTickets = await db("se_project.subsription").where("userid",userid).update({nooftickets : nooftickets });

    return res.status(200).json(tickC);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("error");
  }

});

app.post("/api/v1/senior/request", async function (req, res) {
  const user = await getUser(req);
  const nationalid = req.body.nationalid;
  console.log(user);
  const status = "pending";
  const iC = {
    nationalid,
    status,
    userid:user.userid,
  }

  const requestm = await db
  .select("*")
  .from("se_project.senior_requests")
  .where("nationalid", nationalid)
  .first();

  if (requestm) {
    return res.status(400).send("request already exist");
  }
  
  try {
    
    const tickC = await db("se_project.senior_requests").insert(iC);

    return res.status(200).json( tickC);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("error");
  }

});

app.post("/api/v1/prices", async function (req, res) {   
  let origin =req.body.origin;
  let destination = req.body.destination;
  
  const check = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", origin)
  .first();

  console.log(check.id);

  const check2 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", destination)
  .first();
  console.log(check2.id);
  origin = check.id;

  if(isEmpty(check) || isEmpty(check2)){
    return res.status(400).send("wrong station");
  }
  destination = check2.id;

  // let short = await findShortestPath(origin,destination);
  const list= await makelist();
   console.log("list  is",list);
  const bfsres=await bfs(origin,destination);

  return res.status(200).json({ message: bfsres, bfsres });


});

app.get("/api/v1/zone", async function (req, res) {
      
  try {
    const zone = await db
    .select("*")
    .from("se_project.zones");

    
  for(let i =0 ;i<zone.length;i++){
    res.status(200).json( zone[i]);
  }
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("error");
  }

});

app.put("/api/v1/rides/simulate", async function (req, res) {
  const user = await getUser(req);
  const userid = user.id;
  const origin = req.body.origin;
  const destination = req.body.destination;
  const tripdate = new Date(req.body.tripdate);
 
 
  
  const check = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", origin)
  .first();

  const check2 = await db
  .select("*")
  .from("se_project.stations")
  .where("stationname", destination)
  .first();
  
  if(isEmpty(check) || isEmpty(check2)){
    return res.status(400).send("wrong station");
  }

  const ride = await db
    .select("*")
    .from("se_project.rides")
    .where("origin", origin)
    .andWhere("destination", destination)
    .andWhere("tripdate", tripdate)
    .andWhere("userid", userid);

  if (isEmpty(ride)) {
    return res.status(404).send("no trip");
  }

  try {
    await db("se_project.rides")
      .where("origin", origin)
      .andWhere("destination", destination)
      .andWhere("tripdate", tripdate)
      .andWhere("userid", userid)
      .update({
        status: "Completed"
      })
      .returning("*");

    return res.status(200).send("simulation done");
  } catch (e) {
    return res.status(404).send("error with simulating");
  }
}); 

app.post("/api/v1/refund/:ticketId", async function (req, res) {
  // Get the ticketId from the URL parameter
  const  ticketId  = req.params.ticketId;
  // Assuming you have a user object in req.user (added by authentication middleware)
  const user = await getUser(req);
  const userId = user.userid;
  const today = new Date();
  console.log(user);
  console.log(userId);
  // Fetch the ticket information from the database
  const ticket = await db
      .select("*")
      .from("se_project.tickets")
      .where("id", ticketId)
      .first();
  
    console.log(ticket);
    date= new Date(ticket.tripdate);
  // Check if the ticket exists and is future-dated
  if (isEmpty(ticket) || date<today ) {
    return res.status(400).send("Invalid ticket or ticket not eligible for refund");
  }

  // Set refund status to "pending" and refund amount equal to the ticket price
  let refundStatus = "pending";
  let refundAmount = 5;

 

  // Add a new refund request record to the database
  const newRefundRequest = {
    status: refundStatus,
    userid: userId,
    refundamount: refundAmount,
    ticketid: ticketId,
  };

  try {
    const refundRequest = await db("se_project.refund_requests").insert(newRefundRequest).returning("*");
    return res.status(200).json(refundRequest);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("Could not process refund request");
  }
});

};
let AdgList = new Map();


async function makelist() { 
  const stations = await db('se_project.stations').select('*');
  connectedStations = [];

  stations.forEach((station) => {
    addNode(station.id);
  });
  for (const station of stations) {
    await addEdges(station.stationname, station.id);
  }
  
  return AdgList ;
};

function addNode(id) {
  AdgList.set(id, []);
}

async function addEdges(stationName, stationid) {
  var stations = await db('se_project.routes')
    .where('fromstationid', stationid)
    .orWhere('tostationid', stationid);

  stations.forEach((station) => {
    if (station.fromstationid == stationid) {
      if (!AdgList.has(stationid)) {
        AdgList.set(stationid, []);
      }
      AdgList.get(stationid).push(station.tostationid);
    } else {
      if (!AdgList.has(stationid)) {
        AdgList.set(stationid, []);
      }
      AdgList.get(stationid).push(station.fromstationid);
      // console.log(AdgList);
    }
  });
}

async function bfs(origin, des) {
  console.log("origin is ", origin, "destination is ", des);
  let queue = [{ station: origin, price: 0 }];
  let visited = new Set();

  while (queue.length > 0) {
    const { station, price } = queue.shift();
    const destinations = AdgList.get(station);

    if (destinations) {
      for (const destination of destinations) {
        const newPrice = price + 5; // Add 5 to the price for moving to the next node

        if (destination === des) {
          console.log("found it");
          console.log("visited stations are", visited);
          console.log("price is", newPrice);
          return newPrice;
        }

        if (!visited.has(destination)) {
          visited.add(destination);
          queue.push({ station: destination, price: newPrice });
        }
      }
    }
  }

  console.log("visited stations are", visited);
  console.log("Price not available. Destination station not found.");
  return 0; // Destination not found
}




async function insertIntoTable(inputsArray,tableName) {
  try {
     const row = await db(tableName)
      .insert(inputsArray)      
      .returning('*');

    if (!row) 
      throw new Error('Could not insert inputs');
        
      console.log('Inputs inserted successfully');

    if (tableName === 'se_project.routes') {
      return row[0].id;
    }
    return row[0];

  } catch (error) {
    console.error('Error inserting inputs:', error);
  }
}


async function updatedStationpositionAndType(stationId) {
  let transfer =await isTransfer(stationId);
  console.log('is transfer is : ',transfer,' station id -->',stationId);
  try {
    let changedtype=false;
    console.log('is transfer is : ',transfer); 
    const stationposition = await getStationPositon(stationId);
    console.log('station position is : ',stationposition);
    const fromNum= await getfromNumber(stationId);
    console.log('from number is : ',fromNum);
    const toNum= await gettoNumber(stationId);
    console.log('to number is : ',toNum);
  if(fromNum>=2){
    //change station type to transfer
    console.log('station type is should be transfer ->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>',stationId);
    if(transfer==false){
    changeStationtype(stationId);
    changedtype=true;
    }
  }else{
    //change station type to normal
    console.log('station type is should be normal ->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>',stationId);
    if(transfer==true){
    changeStationtype(stationId);
    changedtype=true;
    }
  }
  console.log('type changed ------------------?????????????',changedtype);
  if(toNum>0 &&fromNum>0){
    //change station position to middle
    updateStationPosition(stationId,'middle');
    console.log('station position is middle');
  }
  if(toNum==0 &&fromNum>0){
    //change station position to start
    updateStationPosition(stationId,'start');
    console.log('station position is start ',stationId);
  }
  if(toNum>0 &&fromNum==0){
    //change station position to end
    updateStationPosition(stationId,'end');
    console.log('station position is end ',stationId);
  }
  if(toNum==0 &&fromNum==0){
    //change station position to undefined
    updateStationPosition(stationId,'undefined');
    console.log('station position is undefined ',stationId);
  }
  } catch (error) {
    console.error('Error updating station position and type:', error);
  }
}


async function getfromNumber(stationId) {
  let counter=0;
  try {
    const routes = await db('se_project.routes')
      .where({ fromstationid: stationId })

      counter = routes.length;
    console.log('routes tal3a from station id : ',stationId,"  number is  ",counter);
    return counter;
  } catch (error) {console.error('Error getting fromstation Number:', error);}
}
async function gettoNumber(stationId) {
  let counter=0;
  try {
    const routes = await db('se_project.routes')
      .where({ tostationid: stationId })
      counter = routes.length;

    console.log('routes dakhla station id : ',stationId,"   number is  ",counter);
    return counter;

  } catch (error) {console.error('Error getting tostation Number:', error);}
}
async function getStationPositon(stationId) {
  try {
    const station = await db('se_project.stations')
      .where({ id: stationId })
      .select('stationposition');
    if (!station) 
      throw new Error('Could not get station');
    return station[0].stationposition;
  } catch (error) {
    console.error('Error getting station:', error);
  }
}

async function updatePassword(userId, newPassword) {
  try {
    console.log("hi from update password");
    console.log('newPassword',newPassword,'userId',userId) 
    if (!isEmpty(newPassword)) {
      await db('se_project.users')
      .where({ id: userId })
      .update({ password: newPassword });
    }
    else{
      throw new Error('Password is empty');
    }
    return 'successfull';
  } catch (error) {
    console.error(error);
    throw new Error('Error updating password');
  }
}

async function updateStation(stationId, stationname, stationtype, stationposition, stationstatus) {
  console.log('stationId',stationId,'stationname',stationname,'stationtype',stationtype,'stationposition',stationposition,'stationstatus',stationstatus);
  try {
    let numper_of_updates=0;

    if (stationname !== undefined && stationname !== '') {
       await db('se_project.stations')
       .where('id', stationId)
       .update({ stationname: stationname });
        numper_of_updates++;
    }
    if (stationtype !== undefined && stationtype !== '') {
      await db('se_project.stations')
      .where('id', stationId)
      .update({ stationtype: stationtype });
       numper_of_updates++;
    }
    if (stationposition !== undefined && stationposition !== '') {
      await db('se_project.stations')
      .where('id', stationId)
      .update({ stationposition: stationposition });
       numper_of_updates++;
    }
    if (stationstatus !== undefined && stationstatus !== '') {
      await db('se_project.stations')
      .where('id', stationId)
      .update({ stationstatus: stationstatus });
       numper_of_updates++;
    }
    if (numper_of_updates === 0) {
      throw new Error('No fields to update');
    }
    console.log('Station updated successfully');
    return 'successful';
  } catch (error) {
    console.error('Error updating station:', error);
    throw new Error('Failed to update station');
  }
}

async function DeleteMiddelStation(StationId) {
  let counter =0;
  try{
    const stations = await getPreviousAndNextStations(StationId);
    console.log('Stations',stations);
    let prevStation=stations.previousStationIds;
    let nextStation=stations.nextStationIds;

    let prev;
    prev = prevStation.pop();

    console.log('prev:', prev); 
    console.log('prevStation:', prevStation);
    console.log('nextStation:', nextStation); 

    if(prevStation.length >= 1){
      prevStation.forEach(async (prevstation) => {
        counter++;
        console.log('making from to to',prevstation,prev);
        await MakeRoute(prevstation,prev);
        console.log('Routes created counter',counter);
      });
    }

    nextStation.forEach(async (nextstation) => {
      counter++;
      console.log (nextstation)
      console.log('making from to to',prev,nextstation);
      await MakeRoute(prev,nextstation);
      console.log('Routes created counter',counter);
    });
    await DeleteCorrspondingRoutes(StationId);
    await deleteStationRow(StationId);

    await updatedStationpositionAndType(prevStation[0]);
    return 'successful';
  }
  catch(error){
    console.error('Error deleting Middle station:', error);
    throw new Error('Failed to delete station');
  }
}

async function MakeRoute(fromstationid,tostationid){
  console.log('in make route')
  console.log('fromstationid',fromstationid,'tostationid',tostationid);
  try{
    const routename="new route";
    let new_route_id =await insertIntoTable([{routename,tostationid,fromstationid}],'se_project.routes');
    console.log('new route id',new_route_id);
    await updatedStationpositionAndType(fromstationid);  
    await updatedStationpositionAndType(tostationid);  
    makeStationRoutes(fromstationid,tostationid,new_route_id);
  }
  catch(error){
    console.error('Error making route:', error);
    throw new Error('Failed to make route');
  }
}

async function delteStartOrEndStation(stationid){ //working in all casses 1-1 1-2 2-1
  try{
    let stations=await getPreviousAndNextStations(stationid);
    console.log('stations',stations);
    let prevStation=stations.previousStationIds;
    let nextStation=stations.nextStationIds;
   await DeleteCorrspondingRoutes(stationid);
    if(prevStation.length>0){
      prevStation.forEach(station => {
        updatedStationpositionAndType(station);
        console.log('updated prev station : ',station);
      });
    }
    else if(nextStation.length>0){
      nextStation.forEach(station => {
     updatedStationpositionAndType(station);
      console.log('updated next station : ',station);
      });
    }
    deleteStationRow(stationid);
    return true;
  }catch(error){
    console.error('Error deleting Start or end station:', error);
    throw new Error('Failed to delete station');
  }
}

async function IsStartOrEndStation(id) { 
  console.log('getting station with id  :',id,' position');
    try{
      let position = await db('se_project.stations')
      .where('id', id)
      .select('stationposition');

      position=position[0]['stationposition'];
      console.log('position is :',position);   
      if(position=='start'){
        return 'start';
      }
      else if(position=='end'){
        return 'end';
      }
      else{
        if(position=='middle')
        return 'middle';
        
        return 'undefined';
      }
    }
    catch(error){
      console.error('Error checking station location:', error);
      throw new Error('Failed to check station location');
    }
}

async function isTransfer(stationId) {
  try{
    console.log('getting station with id  :',stationId,' type');
    if(stationId===undefined){
      return false;      
    }
    const type = await db('se_project.stations')
    .where('id', stationId)
    .select('stationtype');
    console.log('type[0] is ----------------from isTransfer is>>>>>>>>>>> :',type[0]['stationtype']);
    if(type[0]['stationtype']==='transfer')
      return true;   
    else
      return false;
  }
  catch(error){
    console.error('Error checking station type:', error);
    throw new Error('Failed to check station type');
  }
}

async function getPreviousAndNextStations(StationId) {
  var routes = await db('se_project.routes')
  .where('fromstationid', StationId)
  .orWhere('tostationid', StationId)


  const previousStationIds = [];
  const nextStationIds = [];
  routes.forEach(route => {

    if (route['fromstationid'] == StationId) {
      nextStationIds.push(route.tostationid);
    }
    if (route['tostationid'] == StationId) {
      previousStationIds.push(route.fromstationid);
    }
  });
  if (previousStationIds.length == 0 && nextStationIds.length == 0) {
    return { previousStationIds, nextStationIds };
  }
  return { previousStationIds, nextStationIds };
}


async function makeStationRoutes(fromstationid,tostationid,routeid){ //works good
  console.log('tries to make station routes')
  try{
    let stationid=fromstationid;
    console.log('stationid is ',stationid);
    await insertIntoTable([{stationid,routeid}],'se_project.stationroutes');
    stationid=tostationid;
    console.log('stationid is ',stationid);
    await insertIntoTable([{stationid,routeid}],'se_project.stationroutes');
    console.log('made station routes line 573')
    await makeOld(tostationid);
    await makeOld(fromstationid)
  }
  catch(error){
    console.error('Error making station routes:', error);
    throw new Error('Failed to make station routes');
  }
}
//needs testing 
async function makeOld(stationid){
  try{
    const trys = await db('se_project.stations')
    .where('id', stationid)
    .update('stationstatus', 'old')
    .returning('*');
    console.log(trys)
    if(isEmpty(trys)){
      return false
    }else{
      return true
    }
  }
  catch{
    console.error('Error making station old:', error);
    throw new Error('Failed to make station old');   
  }
}

async function DeleteCorrspondingRoutes(stationid){ //works good
  try{
    var routes = await db('se_project.routes')
    .where('fromstationid', stationid)
    .orWhere('tostationid', stationid)
    .del();

    console.log('deleting routes status :',routes);
    if (!routes)
      return res.status(400).send("Could not delete routes");
  }
  catch(error){
    console.error('Error deleting routes for station:', error);
    throw new Error('Failed to delete routes for  station : ',stationid);
  }
}

async function deleteStationRow(stationid){
  try{
    const trys = await db('se_project.stations')
    .where({ id: stationid })
    .del();   

    console.log('station deleted successfully          ',trys);
    if (!trys) 
      return res.status(400).send("Could not delete station");
    
   }catch(error){
    console.error('Error deleting station from deleteStationRow function :', error);
    throw new Error('Failed to delete station');
   }
}
async function getToAndFrom(routeId){
  console.log('getting to and from stations');
  try{
    const route = await db('se_project.routes')
    .where({ id: routeId })
    .select('fromstationid','tostationid');
    if (!route) {
      return res.status(400).send("Could not find route");
    }
    console.log('route found successfully');
    return route;
  }
  catch(error){
    console.error('Error getting to and from stations:', error);
    throw new Error('Failed to get to and from stations');
  }
}
async function chekIfExists(tobecheked,tableName){
  let query;
  try{
    if(tableName==='se_project.stations'){
      query = await db(tableName).where('stationname', tobecheked).returning('*');
    }else if(tableName==='se_project.routes'){
      query = await db(tableName).where('routename', tobecheked).returning('*');
    }
    console.log('query',query);
    if(query.length==0){
      console.log('not found');
      return false;
    }
    else{
      console.log('found')
      return true;

    }
  }
  catch(error){
    console.error('Error checking if exists:', error);
    throw new Error('Failed to check if exists');
  }
}

async function changeStationtype(stationid){
  try{
    console.log('changing station type of station id :',stationid);
    let stationtype=await db('se_project.stations')
    .where('id', stationid)
    .select('stationtype');

    console.log('station type is :',stationtype[0]['stationtype']);
    if(stationtype[0]['stationtype']=='normal'){
      stationtype='transfer';
    }
    else
      stationtype='normal';

    const trys = await db('se_project.stations')
    .where('id', stationid)
    .update('stationtype', stationtype)
    .returning('*');

    console.log('station type changed successfully to :',trys);
    if (!trys) {
      console.log('Could not change station type');
      return ;
    }
    console.log('station type changed successfully');
    return ('successfull');
  }
  catch(error){
    console.error('Error changing station type:', error);
    throw new Error('Failed to change station type');
  }
}
//check if a route can be deleeted
async function routeCanBeDeleted(routeid){ //works fine 
  try{
    console.log('checking if route can be deleted',routeid);

    const connectedStations=await db('se_project.routes')
    .where('id', routeid)
    .select('fromstationid','tostationid');

    let fromstationid=connectedStations[0].fromstationid;
    let tostationid=connectedStations[0].tostationid;

    const fromstation=await db('se_project.stations')
    .where('id', fromstationid)
    .select('stationposition');

    const tostation=await db('se_project.stations')
    .where('id', tostationid)
    .select('stationposition');
    const isFromstationTransfer=await isTransfer(fromstationid);
    let fromstationposition=fromstation[0]['stationposition'];
    let tostationposition=tostation[0]['stationposition'];

    console.log('tal3 mn station  :',fromstationposition,' to  :',tostationposition,'  from-station type is :',isFromstationTransfer);

    if(fromstationposition=='start' || tostationposition=='end'){
      console.log('route can be deleted');
      return true;
    }
    else{
      console.log('route can not be deleted station postions are ',fromstationposition,' and ',tostationposition);
      return false;
    }
  }catch(error){
    console.error('Error checking if route can be deleted:', error);
    throw new Error('Failed to check if route can be deleted');
  }
}
async function updateStationPosition(stationid,stationposition){ //working fine 
  console.log('station id is :',stationid);
  console.log('changing station position to : ',stationposition)
  try{
    const trys = await db('se_project.stations')
    .where('id', stationid)
    .update('stationposition', stationposition);
    if (!trys) {
      console.log('Could not update station position');
      return ;
    }
    console.log('station position updated successfully to :',stationposition);
    return ('successfull');
  }
  catch(error){
    console.error('Error updating station position:', error);
    throw new Error('Failed to update station position');
  }
}
async function deleteRoute(routeId){
  try{
    const trys = await db('se_project.routes')
    .where({ id: routeId })
    .del();
    if (!trys) {
      console.log('Could not delete route');
      return ;
    }
    console.log('station deleted successfully');
    return ('successfull');
  }
  catch(error){
    console.error('Error deleting route:', error);
    throw new Error('Failed to delete route');
  }
}

async function updateRoute(routeId, routename, fromstationid, tostationid) {
  console.log('routeId',routeId,'routename',routename,'fromstation',fromstationid,'tostation',tostationid);
  try {
    let numper_of_updates=0;
    if (routename !== undefined && routename !== '') {
       await db('se_project.routes')
       .where('id', routeId)
       .update({ routename: routename });
       console.log('route name updated');
        numper_of_updates++;
    }
    if (fromstationid !== undefined && fromstationid !== '') {
      await db('se_project.routes')
      .where('id', routeId)
      .update({ fromstationid: fromstationid });
      await updatedStationpositionAndType(fromstationid);
      console.log('from station updated');
       numper_of_updates++;
    }
    if (tostationid !== undefined && tostationid !== '') {
      await db('se_project.routes')
      .where('id', routeId)
      .update({ tostationid: tostationid });
      await updatedStationpositionAndType(tostationid);
      console.log('to station updated');
       numper_of_updates++;
    }

    if (numper_of_updates === 0) {
      throw new Error('No fields to update');
    }
    console.log('Route updated successfully');
    return 'successful';
  } catch (error) {
    console.error('Error updating route:', error);
    throw new Error('Failed to update route');
  }
}