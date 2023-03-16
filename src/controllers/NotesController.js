const AppError = require("../utils/AppError");

const knex = require("../database/knex");

class NotesController {
  async create(request, response) {
    try {
      const { title, rating, description, tags } = request.body;
      const lowerCaseTags = tags.map((tag) => tag.toLowerCase());
      const user_id = request.user.id;
      const availableTags = [
        "aventura",
        "ação",
        "comedia",
        "terror",
        "suspense",
        "ficção",
        "romance",
        "ficção científica",
      ];

      if (rating < 0 || rating > 5) {
        throw new AppError(
          `O numero inserido da sua nota "rating" deve ser entre 0-5`
        );
      }

      const isTagsOk = lowerCaseTags.every((tag) =>
        availableTags.includes(tag.toLowerCase())
      );

      if (!isTagsOk) {
        throw new AppError("Esse tipo de gênero não existe");
      }

      let tagAlreadyExists = await knex("tags", () => {
        this.onIn("name", lowerCaseTags);
      });

      tagAlreadyExists = tagAlreadyExists.map((tag) => tag.name);
      const onlyNewTags = lowerCaseTags.filter(
        (tag) => !tagAlreadyExists.includes(tag)
      );

      const note_id = await knex("notes").insert({
        title,
        rating,
        description,
        user_id,
      });

      const tagsInsert = lowerCaseTags.map((name) => {
        return {
          note_id,
          name,
          user_id,
        };
      });

      if (tagsInsert.length > 0) {
        await knex("tags").insert(tagsInsert);
      }

      return response.json();
    } catch (error) {
      if (error instanceof AppError) {
        return response
          .status(error.statusCode)
          .json({ message: error.message });
      }
      console.error(error);
      return response.status(500).json({ message: "Ocorreu um erro!" });
    }
  }

  async show(request, response) {
    const { id } = request.params;
    const note = await knex("notes").where({ id }).first();
    const tags = await knex("tags").where({ note_id: id }).orderBy("name");

    return response.json({
      ...note,
      tags,
    });
  }

  async delete(request, response) {
    const { id } = request.params;

    await knex("notes").where({ id }).delete();

    return response.json("Deletado com sucesso");
  }

  async index(request, response) {
    const { title, tags } = request.query;

    const user_id = request.user.id;

    let notes;

    if (tags) {
      const filterTags = tags.split(",").map((tag) => tag.trim());

      notes = await knex("tags")
        .select(["notes.id", "notes.title", "notes.user_id"])
        .where("notes.user_id", user_id)
        .whereLike("notes.title", `%${title}%`)
        .whereIn("name", filterTags)
        .innerJoin("notes", "notes.id", "tags.note_id")
        .orderBy("notes.title");
    } else {
      notes = await knex("notes")
        .where({ user_id })
        .whereLike("title", `%${title}%`)
        .orderBy("title");
    }

    const userTags = await knex("tags").where({ user_id });
    const notesWithTags = notes.map((note) => {
      const noteTags = userTags.filter((tag) => tag.note_id === note.id);

      return {
        ...note,
        tags: noteTags,
      };
    });
    return response.json(notesWithTags);
  }
}

module.exports = NotesController;
