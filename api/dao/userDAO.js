const User = require("../models/user");
const GlobalDAO = require("./globalDAO");


class UserDAO extends GlobalDAO {
  
  constructor() {
    super(User);
  }

  
  async findByEmail(email) {
    return this.model.findOne({ email });
  }

  
  async delete(userId) {
    const deletedUser = await this.model.findByIdAndDelete(userId);

    return deletedUser;
  }
}


module.exports = new UserDAO();
