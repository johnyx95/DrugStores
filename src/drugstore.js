/**
 * Created by kobec on 25.04.2017.
 */
var sqlite3 = require('sqlite3').verbose();
var async = require('async');
var express = require('express');
var pretty = require('express-prettify');

var db = new sqlite3.Database('DrugStoreV2.db');
var restapi = express();

restapi.use(pretty({query: 'pretty'}));

function arePointsNear(checkPoint, centerPoint, km) {
    var dLat = (checkPoint.lat - centerPoint.lat) * Math.PI / 180;
    var dLon = (checkPoint.lng - centerPoint.lng) * Math.PI / 180;
    var a = 0.5 - Math.cos(dLat) / 2 + Math.cos(checkPoint.lat * Math.PI / 180)
        * Math.cos(centerPoint.lat * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
    var d = Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)));

    return d <= km * 1000;
}

restapi.route("/drugstores")
    .get(function (req, res) {

        var response = {};
        response.data = [];
        response.messege = "";

        console.log("start get  info about Drug Store for search");

        var drugStoreName;
        var numPage;

        if (res.req.query.num_page)
            numPage = res.req.query.num_page;

        var num = 20 * (numPage - 1);

        if (res.req.query.drug_store_name)
            drugStoreName = res.req.query.drug_store_name;

        var sqlRequest = "select * from DrugStore ";

        if (drugStoreName)
            sqlRequest += " where DrugStore.name like '" + drugStoreName + "'";

        if (numPage == 1)
            sqlRequest += ' limit 0,20';
        else {
            if (numPage > 1)
                sqlRequest += ' limit ' + num + ',20';
        }

        db.all(sqlRequest, function (err, row) {
            response.data = row;
            res.json(response)
        });

        console.log("finish get  info about Drug Store for search");
    });

restapi.route("/drugstores/map/")
    .get(function (req, res) {

        var response = {};
        response.data = [];
        response.messege = "";

        var center;

        if (res.req.query.latitude && res.req.query.longitude)
            center = {lat: parseFloat(res.req.query.latitude), lng: parseFloat(res.req.query.longitude)};
        else {
            response.messege = "Empty required params";
            res.json(response);
            return
        }

        var result = [];

        async.series([
            function (callback) { // Full info
                db.all('Select * from DrugStore', function (err, row) {
                    result = row;
                    callback();
                })
            },
            function (callback) {
                for (var position in result)
                    if (arePointsNear({lat: result[position].latitude, lng: result[position].longitude}, center, 1)) {
                        var drugStoreModel = result[position];

                        response.data.push(drugStoreModel);
                    }
                callback();
            }
        ], function () {
            res.json(response);
        });
    });

restapi.route('*')
    .get(function (req, res) {
        var response = {};
        response.data = [];
        response.messege = "Route not found";
        res.json(response)
    });
restapi.listen(3000);