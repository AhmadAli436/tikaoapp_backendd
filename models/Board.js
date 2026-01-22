import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  language: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
});

const Board = mongoose.models.Board || mongoose.model('Board', boardSchema);

export default Board;