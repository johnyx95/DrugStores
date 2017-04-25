/**
 * Created by kobec on 25.04.2017.
 */
var sqlite3 = require('sqlite3').verbose();
var async = require('async');
var express = require('express');
var pretty = require('express-prettify');

var db = new sqlite3.Database('DrugStores.db');
var restapi = express();

var drugStore = "DrugStore.name, DrugStore.work_time, Location.longitude, " +
    "Location.latitude, Location.address"

restapi.use(pretty({query: 'pretty'}));

function arePointsNear(checkPoint, centerPoint, km) {
    var ky = 40000 / 360;
    var kx = Math.cos(Math.PI * centerPoint.lat / 180.0) * ky;
    var dx = Math.abs(centerPoint.lng - checkPoint.lng) * kx;
    var dy = Math.abs(centerPoint.lat - checkPoint.lat) * ky;
    return Math.sqrt(dx * dx + dy * dy) <= km;
}

var vasteras = { lat: 59.615911, lng: 16.544232 };
var stockholm = { lat: 59.345635, lng: 18.059707 };

var n = arePointsNear(vasteras, stockholm, 1);

console.log(n);

restapi.route("/drugstore_info")
    .get(function (req,res) {
        console.log("start get full info about Drug Store");
        var drugStoreId;
        if (res.req.query.drug_store_id)
            drugStoreId = res.req.query.drug_store_id;
        var response = {};
        async.series([
            function (callback) { // Full info
                db.get('Select ' + drugStore + ' from DrugStore ' +
                    'left join Location on Location.id = DrugStore.location_id ' +
                    'where DrugStore.id = ' + drugStoreId, function (err, row) {
                    response.drugStore = row;
                    callback();
                })
            },
            function (callback) { // Phone number for DrugStores
                var sqlResponse = 'select Phone.number from Phone ' +
                    'left join DrugStore on DrugStore.id = Phone.drugstore_id ' +
                    'where DrugStore.id = ' + drugStoreId;
                db.all(sqlResponse, function (err, row) {
                    response.phone = row;
                    callback();
                })
            }
        ], function () {
            res.json(response);
        });
        console.log("finish get full info about Drug Store")
    });

restapi.route("/drugstore_search")
    .get(function (req,res) {
        console.log("start get  info about Drug Store for search");
        var drugStoreName;
        var numPage;
        if (res.req.query.num_page)
            numPage = res.req.query.num_page;
        var num = 20 * (numPage - 1);
        if(res.req.query.drug_store_name)
            drugStoreName=res.req.query.drug_store_name;
        var sqlRequest = "select DrugStore.id, DrugStore.name, DrugStore.work_time, " +
            "Location.address from DrugStore " +
            "left join Location on Location.id = DrugStore.location_id ";
        if(drugStoreName)
            sqlRequest+= " where DrugStore.name like '" + drugStoreName + "'";
        if (numPage == 1)
            sqlRequest += ' limit 0,20';
        else {
            if (numPage > 1)
                sqlRequest += ' limit ' + num + ',20';
        }
        db.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });
        console.log("finish get  info about Drug Store for search");
    });

restapi.route('*')
    .get(function (req, res) {
        var error = {};
        error.messege = "Route not found";
        res.json(error)
    });
restapi.listen(3000);