require('dotenv').config();

//Require pg for connecting to postgres
var pg = require('pg');
var conString = `postgres://${process.env.USER}:${process.env.PASS}@localhost:5432/urlshort`;
//Create the client for connection to the SQL database
var client = new pg.Client(conString);


const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

//Post API to store/query short URL\
  //First, query database foir existing URL
  //Second, Insert into the table if does not yet exist
  //Finally Qury again for the url_id, and return to client

app.post('/api/shorturl',(req,res)=>{
  
  //Write initial promise
  var sqlQueries = new Promise((resolve,reject)=>{
    //Connect to the database
    client.connect();
    //Query the table for existing entry
    client.query("SELECT * FROM url_table WHERE url_long= $1",[req.body.url],(err,result)=>{
      if(err){
        reject(err);
      }
      else{
        //Return the query results
        resolve(result.rows);
      }
    });
  });

  //Begin promise chain 
  sqlQueries.then(function(value){
    return new Promise((resolve,reject)=>{
      //If data already in table, move to querying for id.
      if(value.length>0){
        resolve(req.body.url);
      }else{
        //Otherwise, if not in the table, insert:
        client.query("INSERT INTO url_table(url_long) VALUES($1)",[req.body.url],(err,result)=>{
          if(err){
            reject(err);
          }
          else{
            resolve(req.body.url);
          }
        });
      }
    }
    );
  })
    .then(function(value){
      return new Promise((resolve,reject)=>{
        //Perform a final query for the short url (url_id)
        client.query("SELECT * FROM url_table WHERE url_long= $1",[value],(err,result)=>{
          client.end();
          if(err){
            reject("Error");
          }else{
            resolve(result.rows);
        }
      });
      });  
    })
    .then(function(value){
      res.json({original_url: value[0].url_long,short_url: value[0].url_id});
    }) // TODO: CHeck the catch statement below works
    .catch((error)=>{res.sendStatus(500)});
}); 






/*
app.post('/api/shorturl',function(req,res,next){
  //Get the long URL from the post request
  //Set up a connection to postgresql
  //Check if the url already exists
  var row_result = [];
  var url_short;

  console.log(get_saved_url(req.body.url));
  //res.locals.row_result = get_saved_url(req.body.url);
  next();
},function(req,res,next){
  if(res.locals.row_result==[]){
    //If no url in table then update the table
    insert_url(req.body.url);
  }else{
    //Otherwise set the url short to the query result
    console.log(res.locals.row_result);
    res.locals.url_short = res.locals.row_result.url_id;
  }
  next();
  },function(req,res){
    var url_short;
    //Requery for the short url if was inserted
    if(res.locals.row_result==[]){
      url_short = get_saved_url(req.body.url)[0].url_id;
    }else{
      url_short = res.locals.url_short;
    }

    res.json({original_url: req.body.url,short_url: url_short});
  });
*/
//Postgresql functions
