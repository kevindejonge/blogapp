var pg = require("pg");
var Promise = require('promise');
var connectionString = "postgres://kevin@localhost/kevin_database";
var express = require("express");
var app = express();
var bodyParser = require('body-parser');
var session = require('express-session');
var Sequelize = require('sequelize');
var bcrypt = require('bcrypt');



var sequelize = new Sequelize('kevin_database', process.env.POSTGRES_USER, null, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		timestamps: false
	}
});

var gebruiker = sequelize.define('appusers', {
	username: Sequelize.STRING,
	email: Sequelize.STRING,
	password: Sequelize.STRING
}, {
	freezeTableName: true,
	instanceMethods: {
		generateHash: function(password) {
			return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
		},
		validPassword: function(password) {
			return bcrypt.compareSync(password, this.password);
		},
	}
});


var Post = sequelize.define('appmessages', {
	title: Sequelize.TEXT,
	body: Sequelize.TEXT,
	appusers_id: Sequelize.INTEGER,
	author: Sequelize.STRING
});

var comment = sequelize.define('comment', {
	body: Sequelize.TEXT,
	author: Sequelize.STRING,
	post_id: Sequelize.INTEGER
});


gebruiker.hasMany(Post);
Post.belongsTo(gebruiker);
comment.belongsTo(Post);
Post.hasMany(comment);
comment.belongsTo(gebruiker);
gebruiker.hasMany(comment);

app.use(session({
	secret: 'oh wow very secret much security',
	resave: true,
	saveUninitialized: false
}));

app.set('views', './src/views');
app.set('view engine', 'jade');

app.get('/', function(request, response) {
	response.render('index', {
		Post: request.query.Post,
		username: request.session.username,
		message: request.query.message
	});
});


app.get('/users/new', function(request, response) {
	response.render('users/new');
});

app.get('/users/messages', function(request, response) {
	response.render('users/messages');
});

app.get('/users/comments', function(request, response) {
	response.render('users/comments');
});

app.get('/users/showmessages', function(request, response) {
	var username = request.session.username;
	var postjes = request.session.username.id;
	Post.findAll().then(function(posts) {
		var data = posts.map(function(appmessages) {
			return {
				id: appmessages.dataValues.id,
				title: appmessages.dataValues.title,
				body: appmessages.dataValues.body,
				appusers_id: appmessages.dataValues.appusers_id,
				author: appmessages.dataValues.author,
			}
		})
		allPosts = data;
	}).then(gebruiker.findAll().then(function(gebruikers) {
		var data = gebruikers.map(function(appusers) {
			return {
				username: appusers.dataValues.username,
				email: appusers.dataValues.email
			}
		})
		allUsers = data;
	})).then(comment.findAll().then(function(comments) {
		var data = comments.map(function(comment) {
			return {
				body: comment.dataValues.body,
				author: comment.dataValues.author
			}
		})
		allComments = data;
	})).then(function() {
		response.render('users/showmessages', {
			allPosts: allPosts,
			// allUsers: allUsers,
		});
	});
});
// Toevoegen dat de gebruikers berichten bekeken kunnen worden. 

app.get('/users/:id', function(request, response) {
	var username = request.session.username;
	// var ID = request.session.username.id;
	if (username === undefined) {
		response.redirect('/?message=' + encodeURIComponent("Please log in to view your profile."));
	} else {
		response.render('users/profile', {
			username: username,
		});
	}
});


app.get('/users/posts/:id', function(request, response) {
	var username = request.session.username;
	var ID = request.session.username.id;
	Post.findAll().then(function(posts) {
		var data = posts.map(function(appmessages) {
			return {
				id: appmessages.dataValues.id,
				title: appmessages.dataValues.title,
				body: appmessages.dataValues.body,
				appusers_id: appmessages.dataValues.appusers_id,
				author: appmessages.dataValues.author,
			}
		})
		allPosts = data;
	}).then(Post.findAll({
		where: {
			appusers_id: ID,
		}
	}).then(function(posts) {
		var data = posts.map(function(appmessages) {
			return {
				id: appmessages.dataValues.id,
				title: appmessages.dataValues.title,
				body: appmessages.dataValues.body,
				appusers_id: appmessages.dataValues.appusers_id,
				author: appmessages.dataValues.author,
			}
		})
		allPosts = data;
	}).then(comment.findAll().then(function(comments) {
		var data = comments.map(function(comment) {
			return {
				body: comment.dataValues.body,
				post_id: comment.dataValues.post_id,
				author: comment.dataValues.author,
			}
		})
		allComments = data;
	})).then(function() {
		response.render('users/showmessages', {
			allPosts: allPosts,
			// allComments: allComments,
			ID: ID
		});
		console.log(allPosts);
	}));
});

app.get('/singlepost/:postid', function(request, response) {
	if (request.session.username != undefined) {
		postID = request.params.postid;
		Post.findById(postID)
			.then(function(post) {
				gebruiker.findAll().then(function(gebruikers) {
						var data = gebruikers.map(function(appusers) {
							return {
								username: appusers.dataValues.username,
								email: appusers.dataValues.email,
								id: appusers.dataValues.username.id
							}
						})
						allUsers = data;
					})
					.then(function() {
						for (user in allUsers) {
							if (allUsers[user].id === post.appusers_id) {
								post.author = allUsers[user].username;
							}
						}
					})
					.then(comment.findAll({
							where: {
								post_id: postID
							}
						})
						.then(function(comments) {
							var data = comments.map(function(comment) {
								return {
									body: comment.dataValues.body,
									author: comment.dataValues.author
								}
							});
							allComments = data.reverse();
						})
						.then(function() {
							response.render('users/singlepost', {
								postID: postID,
								post: post,
								allComments: allComments,
								username: request.session.username,
								ID: request.session.username.id
							});
							console.log(allComments);
						}));
			})
	} else {
		response.redirect('/');
	}
});



app.post('/login', bodyParser.urlencoded({
	extended: true
}), function(request, response) {
	gebruiker.findOne({
		where: {
			email: request.body.email
		}
	}).then(function(username) {
		var hashpassword = request.body.password;
		bcrypt.compare(hashpassword, username.password.toString(), function(err, result) {
			if (err !== undefined) {
				console.log(err);
			} else {
				console.log(result)
				if (username !== null && result === true) {
					request.session.username = username;
					response.redirect('/');
				} else {
					console.log("gaat iets fout")
					response.redirect('/?message=' + encodeURIComponent("Invalid email or password."));
				}
			};
		});


	});
});



app.get('/logout', function(request, response) {
	request.session.destroy(function(error) {
		if (error) {
			throw error;
		}
		response.redirect('/?message=' + encodeURIComponent("Successfully logged out."));
	})
});


app.post('/users/new', bodyParser.urlencoded({
	extended: true
}), function(request, response) {
	var usernamed = request.body.username;
	var emailed = request.body.email;
	var passworded = request.body.password;

	bcrypt.hash(passworded, 8, function(err, hash) {
		if (err !== undefined) {
			console.log(err);
		} else {
			console.log(hash);
			gebruiker.create({
				username: usernamed,
				password: hash,
				email: emailed
			})
			console.log("User Created in Database");
			response.redirect('/?message=' + encodeURIComponent("User created! Log in to view your profile."))
		}

	});
});
// comments toevoegen 

app.post('/users/messages', bodyParser.urlencoded({
	extended: true
}), function(request, response) {
	var titlez = request.body.titlez;
	var bodyz = request.body.bodyz;
	var ID = request.session.username.id;
	var Author = request.session.username.username;
	Post.create({
		title: titlez,
		body: bodyz,
		appusers_id: ID,
		author: Author
	})
	response.redirect('/users/showmessages')
});


app.post('/singlepost/comments', bodyParser.urlencoded({
	extended: true
}), function(request, response) {
	var commentz = request.body.commentz;
	var Author = request.session.username.username;

	comment.create({
		body: commentz,
		author: Author,
		post_id: postID
	})
	response.render('users/showmessages')
});

sequelize.sync().then(function() {
	var server = app.listen(3000, function() {
		console.log('Example app listening on port: ' + server.address().port);
	});
});