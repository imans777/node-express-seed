/**
 * Created by Amin on 01/02/2017.
 */
const sql = require('../sql');
const env = require('../env');
const helpers = require('./helpers');
const SqlTable = require('./sqlTable.model');
const error = require('./errors.list');
const jsonwebtoken = require('jsonwebtoken');

let tableName = 'users';
let idColumn  = 'uid';

class User extends SqlTable{
  constructor(test=User.test){
    super(tableName, idColumn, test);
  }

  load(username,password){
    this.password = password;
    this.username = username.toLowerCase();
    return super.load({name:this.username});
  }

  importData(data) {
    this.secret = data.secret;
    this.uid = data.uid;
    this.is_admin = this.username && helpers.adminCheck(this.username);
  }

  exportData(){
    return new Promise((resolve, reject) => {
      let exprt = {};
      if(!this.password){
        if(!this.username)
          reject(error.emptyUsername);
        else
          resolve({name:this.username.toLowerCase()});
      }
      else {
        env.bcrypt.genSalt(101, (err, salt) => {
          if (err)
            reject(err);
          else
            env.bcrypt.hash(this.password, salt, null, (err, hash) => {
              if (err)
                reject(err);
              else
                this.secret = hash;

              if(this.username)
                exprt.name = this.username.toLowerCase();
              exprt.secret = hash;
              resolve(exprt);
            });
        });
      }
    });
  }

  checkPassword() {
    return new Promise((resolve, reject) => {
      if(!this.secret)
        reject(error.noPass);
      env.bcrypt.compare(this.password, this.secret, (err, res) => {
        if(err)
          reject(err);
        else if (!res)
          reject(error.badPass);
        else
          resolve();
      });
    });
  }

  loginCheck(username=this.username, password=this.password) {
    return new Promise((resolve,reject) => {
      this.load(username,password)
        .then(()=>this.checkPassword().then(resolve()).catch(err=>reject(error.badPass)))
        .catch(err=>reject(error.noUser));
    })
  }

  insert(data){
    this.username = data.username;
    this.password = data.password;
    return this.save();
  }

  update(uid, data){
    this.uid = uid;
    if(data.username)
      this.username = data.username;
    if(data.password)
      this.password = data.password;
    return this.save();
  }

  static signToken(request, username, password, secretKey){
    return new Promise((resolve, reject) => {
      let user = new User(helpers.isTestReq(request));
      user.loginCheck(username, password)
        .then(res => {
          jsonwebtoken.sign(user.secret.substring(0, 3) + username, secretKey, (err, token) => {
            if(err)
              reject(err);
            else
              resolve({
                tid: user.username,
                token: token,
                user: user
              });
          })
        })
        .catch(err => reject(err));
    });
  }

  static verifyCallback(token, user, secretKey) {
    return new Promise((resolve, reject) => {
      jsonwebtoken.verify(token, secretKey, user, (err, decoded) => {
        if(err)
          reject(err);
        else{
          if(decoded === (user.secret.substring(0, 3) + user.name))
            resolve(decoded);
          else
            reject('Cannot match token');
        }
      });
    });
  };

  static loadUser(req, username){
    return new Promise((resolve, reject) => {
      let curSql = helpers.isTestReq(req) ? sql.test : sql;

      curSql.users.get({name: username})
        .then(res => {
          //Please add all data to res
          res[0].username = res[0].name;
          resolve(res[0]);
        })
        .catch(err => reject(err));
    });
  }

  static afterLogin(username) {
    return new Promise((resolve, reject) => {
      resolve({user:username,userType:username==='admin'?'admin':'user'});
    })
  }

  static select(){
    let curSql = User.test ? sql.test : sql;
    return curSql.users.select();
  }

  static delete(id){
    let curSql = User.test ? sql.test : sql;
    return curSql.users.delete(id);
  }
}
User.test = false;
module.exports = User;