/**
 * Created by kobec on 25.04.2017.
 */
var sqlite3 = require('sqlite3').verbose();
var async = require('async');
var express = require('express');
var pretty = require('express-prettify');

var db = new sqlite3.Database('DrugStoreV2.db');
var db1 = new sqlite3.Database('ClinicsDB2.db');
var restapi = express();

var clinic_info = " Clinic.id, Clinic.logo_url, Clinic.name, Clinic.rating, Clinic.short_description," +
    "Clinic.full_description, Clinic.location, Clinic.has_parking_lot, Clinic.has_epay, Clinic.speak_english," +
    "Clinic.has_wifi, Clinic.has_pharamcy, Clinic.has_children_room, Clinic.has_invalid ";
var clinic_info_wth_id = " Clinic.logo_url, Clinic.name, Clinic.rating, Clinic.short_description," +
    "Clinic.full_description, Clinic.location, Clinic.has_parking_lot, Clinic.has_epay, Clinic.speak_english," +
    "Clinic.has_wifi, Clinic.has_pharamcy, Clinic.has_children_room, Clinic.has_invalid ";

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

        if (res.req.query.name)
            drugStoreName = res.req.query.name;

        var sqlRequest = "select * from DrugStore ";

        if (drugStoreName)
            sqlRequest += " where DrugStore.name like '%" + drugStoreName + "%'";

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

restapi.route('/clinic_full_info')
    .get(function (req, res) {
        console.log("start get full info about clinics");
        var clinicId;
        if (res.req.query.clinic_id)
            clinicId = res.req.query.clinic_id;
        var response = {};

        async.series([
            function (callback) { // Full info from Clinic without id
                db1.get('Select ' + clinic_info_wth_id + ' from Clinic where Clinic.id = ' + clinicId, function (err, row) {
                    response.clinic = row;
                    callback();
                })
            },
            function (callback) { // District for Clinic.id
                var sqlResponse = 'select District.name from District ' +
                    'left join Location on Location.district_id=District.id ' +
                    'left join Clinic on Clinic.location=Location.id ' +
                    'where Clinic.id = ' + clinicId;
                db1.get(sqlResponse, function (err, row) {
                    response.district = row;
                    callback();
                })
            },
            function (callback) { // Services for Clinic.id
                var sqlRequest = 'select Specialization.name, Specialization.id from Specialization ' +
                    'left join Specilizations on Specilizations.specializtion_id = Specialization.id ' +
                    'left join Clinic on Clinic.id = Specilizations.clinic_id ' +
                    'where Clinic.id =' + clinicId;
                db1.all(sqlRequest, function (err, row) {
                    response.services = row;
                    callback();
                })
            },
            function (callback) { // address and coordinates for Clinic.id
                var sqlRequest = 'select Location.address, Location.longitude, Location.latitude from Location ' +
                    'left join Clinic on Clinic.id = Location.id ' +
                    'where Clinic.id = ' + clinicId;
                db1.get(sqlRequest, function (err, row) {
                    response.location = row;
                    callback();
                })
            },
            function (callback) { // metro name, line
                var sqlRequest = 'select Metro.name, Metro.line from Metro ' +
                    'left join Location on Location.metro_id = Metro.id ' +
                    'left join Clinic on Clinic.location = Location.id ' +
                    'where Clinic.id = ' + clinicId;
                db1.get(sqlRequest, function (err, row) {
                    response.metro = row;
                    callback();
                })
            },
            function (callback) {
                var sqlRequest = 'select Worktime.time_interval, Worktime.day_interval from Worktime ' +
                    'left join Clinic on Clinic.id = Worktime.clinic_id ' +
                    'where Clinic.id =' + clinicId;
                db1.all(sqlRequest, function (err, row) {
                    response.worktime = row;
                    callback();
                })
            },
            function (callback) {
                var sqlRequest = 'select Photo.url from Photo ' +
                    'left join Clinic on Clinic.id = Photo.clinic_id ' +
                    'where Clinic.id = ' + clinicId;
                db1.all(sqlRequest, function (err, row) {
                    response.gallery = row;
                    callback();
                })
            }
        ], function () {
            res.json(response);
        });
        console.log("finish get full info about clinics")
    });

restapi.route('/clinics_services_districts')
    .get(function (req, res) {
        console.log("start get clinic_info with district, services option");
        var serviceId;
        var numPage;
        if (res.req.query.service_id)
            serviceId = res.req.query.service_id;
        var distirctId;
        if (res.req.query.district_id)
            distirctId = res.req.query.district_id;
        if (res.req.query.num_page)
            numPage = res.req.query.num_page;
        var num = 20 * (numPage - 1);
        if (!serviceId && (!distirctId))
            var sqlRequest = 'SELECT' + clinic_info + 'FROM Clinic ';
        else {
            sqlRequest = 'SELECT' + clinic_info + 'FROM Specialization ' +
                'inner join Specilizations on Specilizations.specializtion_id=Specialization.id ' +
                'inner join Clinic on Clinic.id=Specilizations.clinic_id ' +
                'inner join Location on Location.id=Clinic.location ' +
                'inner join District on District.id=Location.district_id';
        }
        if (serviceId && distirctId) {
            sqlRequest += ' where Specialization.id =' + serviceId + ' and District.id=' + distirctId;
        } else {
            if (serviceId || distirctId) {
                sqlRequest += ' where ';
                if (serviceId) {
                    sqlRequest += 'Specialization.id =' + serviceId;
                }
                else {
                    sqlRequest += 'District.id=' + distirctId;
                }
            }
        }
        if (numPage == 1)
            sqlRequest += ' limit 0,20';
        else {
            if (numPage > 1)
                sqlRequest += ' limit ' + num + ',20';
        }
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });

        console.log("finish get clinic_info with district, services option");

    });

restapi.route('/clinics_services_rating')
    .get(function (req, res) {
        console.log("start get start get clinic_info with rating, services option");
        var numPage;
        var serviceId;
        if (res.req.query.service_id)
            serviceId = res.req.query.service_id;
        var rating;
        if (res.req.query.rating_id)
            rating = res.req.query.rating_id;
        if (res.req.query.num_page)
            numPage = res.req.query.num_page;
        var num = 20 * (numPage - 1);
        if (!serviceId && (!rating))
            var sqlRequest = 'SELECT' + clinic_info + 'FROM Clinic ';
        else {
            var sqlRequest = 'SELECT' + clinic_info + 'FROM Specialization ' +
                'inner join Specilizations on Specilizations.specializtion_id=Specialization.id ' +
                'inner join Clinic on Clinic.id=Specilizations.clinic_id ' +
                'inner join Location on Location.id=Clinic.location ' +
                'inner join District on District.id=Location.district_id';
        }
        if (serviceId && rating) {
            sqlRequest += ' where Specialization.id =' + serviceId + ' and Clinic.rating>' + rating;
        } else {
            if (serviceId || rating) {
                sqlRequest += ' where ';
                if (serviceId) {
                    sqlRequest += 'Specialization.id =' + serviceId;
                }
                else {
                    sqlRequest += 'Clinic.rating>' + rating;
                }
            }
        }
        if (numPage == 1)
            sqlRequest += ' limit 0,20';
        else {
            if (numPage > 1)
                sqlRequest += ' limit ' + num + ',20';
        }
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });

        console.log("finish get start get clinic_info with rating, services option");

    });

restapi.route('/clinics_metro_name')
    .get(function (req, res) {
        console.log("start get start get clinic_info with metro_name option");
        var numPage;
        var metroId;
        if (res.req.query.num_page)
            numPage = res.req.query.num_page;
        var num = 20 * (numPage - 1);
        if (res.req.query.metro_id)
            metroId = res.req.query.metro_id;
        if (!metroId)
            var sqlRequest = 'SELECT' + clinic_info + 'FROM Clinic ';
        else {
            var sqlRequest = 'SELECT' + clinic_info + 'FROM Metro Inner Join Location on Location.metro_id=Metro.id ' +
                'Inner Join Clinic on Clinic.location=Location.id ' +
                'where Metro.id=' + metroId;
        }
        if (numPage == 1)
            sqlRequest += ' limit 0,20';
        else {
            if (numPage > 1)
                sqlRequest += ' limit ' + num + ',20';
        }
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });
        console.log("finish get start get clinic_info with metro_name option");
    });

restapi.route('/services')
    .get(function (req, res) {
        console.log("start get services from spicialization")
        var sqlRequest = 'select * from Specialization';
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });
        console.log("finish get services")
    });

restapi.route('/districts')
    .get(function (req, res) {
        console.log("start get district")
        var sqlRequest = 'select * from District';
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });
        console.log("finish get district")
    });

restapi.route('/metro')
    .get(function (req, res) {
        console.log("start get metro_info")
        var sqlRequest = 'select * from Metro';
        db1.all(sqlRequest, function (err, row) {
            res.json({"data": row})
        });
        console.log("finish get metro_info")
    });


restapi.route('*')
    .get(function (req, res) {
        var response = {};
        response.data = [];
        response.messege = "Route not found";
        res.json(response)
    });

restapi.listen(80);
