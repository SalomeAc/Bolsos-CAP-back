
class GlobalDAO {
  
  constructor(model) {
    this.model = model;
  }

  
  async create(data) {
    const document = new this.model(data);
    return await document.save();
  }

  
  async read(id) {
    const document = await this.model.findById(id);
    return document;
  }

  
  async update(id, updateData) {
    const updatedDocument = await this.model.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    return updatedDocument;
  }

  
  async delete(id) {
    const deletedDocument = await this.model.findByIdAndDelete(id);
    return deletedDocument;
  }

  
  async getAll(filter = {}) {
    return await this.model.find(filter);
  }
}


module.exports = GlobalDAO;
