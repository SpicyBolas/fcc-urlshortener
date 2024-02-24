require('dotenv').config();

//Require pg for connecting to postgres
var pg = require('pg');
var conString = `postgres://${process.env.USER}:${process.env.PASS}@localhost:5432/urlshort`;
//Create the client for connection to the SQL database
var client = new pg.Client(conString);

//Require dns-lookup to validate the url
var lookup = require('dns-lookup');

//Require express and create app
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
  var client = new pg.Client(conString);
  //Write initial promise
  
  //Use regex to remove the http/s prefix with a look behind
  var re = /^(https:\/\/|http:\/\/)/g;
  var input_url = req.body.url.replace(re,'');
  var sqlQueries = new Promise((resolve,reject)=>{
    //Check the url begins with www
    var re_www = /^www\..+/;
    if(!re_www.test(input_url)){
      input_url = 'www.' + input_url;
    }

    lookup(input_url,function(err,address,family){
      if(err){
        reject("invalid url");
      }
      else{
        resolve(req.body.url);
      }
    })
  });

  //Begin promise chain 
  sqlQueries.then(function(value){
    return  new Promise((resolve,reject)=>{
    //Connect to the database
    client.connect();
    //Query the table for existing entry
    client.query("SELECT * FROM url_table WHERE url_long= $1",[value],(err,result)=>{
      if(err){
        client.end();
        reject(err);
      }
      else{
        //Return the query results
        resolve(result.rows);
      }
    });
  });
  })
    .then(function(value){
      return new Promise((resolve,reject)=>{
        //If data already in table, move to querying for id.
        if(value.length>0){
          
          resolve(re.exec(req.body.url)[0]);
        }else{
          //Otherwise, if not in the table, insert:
          client.query("INSERT INTO url_table(url_long) VALUES($1)",[req.body.url],(err,result)=>{
            if(err){
              client.end();
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
          if(err){
            client.end();
            reject(err);
          }else{
            client.end();
            resolve(result.rows);
        }
      });
      });  
    })
    .then(function(value){
      res.json({original_url: value[0].url_long,short_url: value[0].url_id});
    }) // TODO: CHeck the catch statement below works
    .catch((err)=>{res.json({error: err})});
}); 

//Set up a get API to link to the requestedn website
app.get('/api/:shorturl',function(req,res){
  var client = new pg.Client(conString);
  var redirectUser = new Promise((resolve,reject)=>{ 
    client.connect();
     client.query("SELECT * FROM url_table WHERE url_id= $1",[req.params.shorturl],(err,result)=>{
          client.end();
          if(err){
            client.end();
            reject(err);
          }else if(result.rows.length==0){
            reject("Short URL does not exist");
          }else{
            resolve(result.rows[0].url_long);
        }
      })});

      //If successful, redirect to website, otherwise throw error
      redirectUser.then(function(value){
        res.redirect(value);
      })
      .catch((error)=>{res.send(error)});
  });
