
class GlobalController {
  
  constructor(dao) {
    this.dao = dao;
  }

  
  async create(req, res) {
    try {
      const item = await this.dao.create(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error(`Error in create: ${error.message}`);
      res.status(400).json({
        message: error.message || "Error creating item",
      });
    }
  }

  
  async read(req, res) {
    try {
      const item = await this.dao.read(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.status(200).json(item);
    } catch (error) {
      console.error(`Error in read: ${error.message}`);
      res.status(500).json({
        message: "Internal server error, try again later",
      });
    }
  }

  
  async update(req, res) {
    try {
      const item = await this.dao.update(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.status(200).json(item);
    } catch (error) {
      console.error(`Error in update: ${error.message}`);
      res.status(400).json({
        message: error.message || "Error updating item",
      });
    }
  }

  
  async delete(req, res) {
    try {
      const item = await this.dao.delete(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error(`Error in delete: ${error.message}`);
      res.status(500).json({
        message: "Internal server error, try again later",
      });
    }
  }

  
  async getAll(req, res) {
    try {
      const items = await this.dao.getAll(req.query);
      res.status(200).json(items);
    } catch (error) {
      console.error(`Error in getAll: ${error.message}`);
      res.status(500).json({
        message: "Internal server error, try again later",
      });
    }
  }
}


module.exports = GlobalController;
