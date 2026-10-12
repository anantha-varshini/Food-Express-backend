const {Pool}=require("pg");
require ("dotenv").config();

const pool=new Pool({
    host:"localhost",
    port:5432,
    database:"food",
    user:"postgres",
    password:"root",
});

pool.on("error",(err)=>{
    console.error("Unexpected PostgreSQL error:",err.message);
});

module.exports=pool;