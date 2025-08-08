// ========================================
// 📚 API BIBLIOTECA PERSONAL - QA TESTING
// ========================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ========================================
// 🔧 CONFIGURACIÓN
// ========================================

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'biblioteca_secret_2024_muy_seguro_para_qa_testing';

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// 👥 CONFIGURACIÓN DE ESTUDIANTES
// ========================================

const STUDENT_THEMES = {
  'ARGENIS': { 
    emoji: '🦅', 
    theme: 'Águila Estudiosa', 
    color: '#1E40AF',
    description: 'Vuela alto en el conocimiento'
  },
  'CALEB': { 
    emoji: '🦁', 
    theme: 'León Lector', 
    color: '#DC2626',
    description: 'Rey de la literatura'
  },
  'KATHERINE': { 
    emoji: '🦋', 
    theme: 'Mariposa Sabia', 
    color: '#7C3AED',
    description: 'Transforma cada lectura'
  },
  'LUIS': { 
    emoji: '🐺', 
    theme: 'Lobo Literario', 
    color: '#059669',
    description: 'Caza conocimiento en manada'
  },
  'SOFIA': { 
    emoji: '🦌', 
    theme: 'Cierva Intelectual', 
    color: '#EA580C',
    description: 'Astuta coleccionista de sabiduría'
  }
};

const STUDENTS = {
  'ARGENIS': {
    id: 'ARGENIS',
    fullName: 'Argenis Bennett Cubero',
    email: 'argenis@biblioteca.com',
    dbFile: 'db_argenis.json',
    theme: STUDENT_THEMES['ARGENIS']
  },
  'CALEB': {
    id: 'CALEB', 
    fullName: 'Caleb Masis Vasquez',
    email: 'caleb@biblioteca.com',
    dbFile: 'db_caleb.json',
    theme: STUDENT_THEMES['CALEB']
  },
  'KATHERINE': {
    id: 'KATHERINE',
    fullName: 'Katherine Denise Steward Vargas', 
    email: 'katherine@biblioteca.com',
    dbFile: 'db_katherine.json',
    theme: STUDENT_THEMES['KATHERINE']
  },
  'LUIS': {
    id: 'LUIS',
    fullName: 'Luis Salazar',
    email: 'luis@biblioteca.com', 
    dbFile: 'db_luis.json',
    theme: STUDENT_THEMES['LUIS']
  },
  'SOFIA': {
    id: 'SOFIA',
    fullName: 'Sofia Natasha Aguilar Chacon',
    email: 'sofia@biblioteca.com',
    dbFile: 'db_sofia.json', 
    theme: STUDENT_THEMES['SOFIA']
  }
};

const BOOK_STATUSES = ['to-read', 'reading', 'read', 'abandoned'];

// ========================================
// 🗄️ FUNCIONES DE BASE DE DATOS
// ========================================

class DatabaseManager {
  getDbPath(studentId) {
    return path.join(__dirname, 'data', `db_${studentId.toLowerCase()}.json`);
  }

  async readStudentDb(studentId) {
    try {
      const dbPath = this.getDbPath(studentId);
      const data = await fs.readFile(dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.createEmptyDb();
      }
      throw error;
    }
  }

  async writeStudentDb(studentId, data) {
    try {
      const dbPath = this.getDbPath(studentId);
      
      data.metadata = {
        ...data.metadata,
        lastAccess: new Date().toISOString(),
        totalOperations: (data.metadata?.totalOperations || 0) + 1
      };

      await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error(`Error escribiendo DB para ${studentId}:`, error);
      throw error;
    }
  }

  createEmptyDb() {
    return {
      user: null,
      books: [],
      metadata: {
        createdAt: new Date().toISOString(),
        lastAccess: new Date().toISOString(),
        totalOperations: 0
      }
    };
  }

  async createUser(studentId, userData) {
    const db = await this.readStudentDb(studentId);
    
    if (db.user) {
      throw new Error('Usuario ya existe');
    }

    const userId = `${studentId.toLowerCase()}_001`;
    
    db.user = {
      id: userId,
      name: userData.name,
      email: userData.email,
      studentId: studentId.toUpperCase(),
      password: userData.hashedPassword,
      createdAt: new Date().toISOString(),
      active: true
    };

    await this.writeStudentDb(studentId, db);
    return db.user;
  }

  async getUser(studentId) {
    const db = await this.readStudentDb(studentId);
    return db.user;
  }

  async getBooks(studentId, filters = {}, pagination = {}) {
    const db = await this.readStudentDb(studentId);
    let books = [...db.books];

    // Aplicar filtros
    if (filters.genre) {
      books = books.filter(book => 
        book.genre?.toLowerCase().includes(filters.genre.toLowerCase())
      );
    }
    
    if (filters.status) {
      books = books.filter(book => book.status === filters.status);
    }
    
    if (filters.author) {
      books = books.filter(book => 
        book.author?.toLowerCase().includes(filters.author.toLowerCase())
      );
    }
    
    if (filters.year) {
      books = books.filter(book => book.year == filters.year);
    }
    
    if (filters.rating) {
      books = books.filter(book => book.rating >= parseInt(filters.rating));
    }

    // Ordenamiento
    if (filters.sort) {
      const sortField = filters.sort;
      const order = filters.order === 'desc' ? -1 : 1;
      
      books.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        return 0;
      });
    }

    // Paginación
    const page = parseInt(pagination.page) || 1;
    const limit = parseInt(pagination.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedBooks = books.slice(startIndex, endIndex);
    
    return {
      books: paginatedBooks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(books.length / limit),
        totalBooks: books.length,
        booksPerPage: limit,
        hasNext: endIndex < books.length,
        hasPrev: page > 1
      }
    };
  }

  async getBookById(studentId, bookId) {
    const db = await this.readStudentDb(studentId);
    return db.books.find(book => book.id === bookId);
  }

  async addBook(studentId, bookData) {
    const db = await this.readStudentDb(studentId);
    
    const newBook = {
      id: uuidv4(),
      title: bookData.title,
      author: bookData.author,
      genre: bookData.genre || null,
      year: bookData.year || null,
      pages: bookData.pages || null,
      rating: bookData.rating || null,
      status: bookData.status || 'to-read',
      notes: bookData.notes || '',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.books.push(newBook);
    await this.writeStudentDb(studentId, db);
    
    return newBook;
  }

  async updateBook(studentId, bookId, updateData) {
    const db = await this.readStudentDb(studentId);
    const bookIndex = db.books.findIndex(book => book.id === bookId);
    
    if (bookIndex === -1) {
      return null;
    }

    const allowedFields = ['title', 'author', 'genre', 'year', 'pages', 'rating', 'status', 'notes'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        db.books[bookIndex][field] = updateData[field];
      }
    });

    db.books[bookIndex].updatedAt = new Date().toISOString();
    
    await this.writeStudentDb(studentId, db);
    return db.books[bookIndex];
  }

  async deleteBook(studentId, bookId) {
    const db = await this.readStudentDb(studentId);
    const bookIndex = db.books.findIndex(book => book.id === bookId);
    
    if (bookIndex === -1) {
      return null;
    }

    const deletedBook = db.books.splice(bookIndex, 1)[0];
    await this.writeStudentDb(studentId, db);
    
    return deletedBook;
  }

  async getStats(studentId) {
    const db = await this.readStudentDb(studentId);
    const books = db.books;

    const stats = {
      totalBooks: books.length,
      booksRead: books.filter(b => b.status === 'read').length,
      booksReading: books.filter(b => b.status === 'reading').length,
      booksToRead: books.filter(b => b.status === 'to-read').length,
      booksAbandoned: books.filter(b => b.status === 'abandoned').length
    };

    const booksWithPages = books.filter(b => b.pages);
    const booksWithRating = books.filter(b => b.rating);
    
    const reading = {
      totalPages: booksWithPages.reduce((sum, b) => sum + (b.pages || 0), 0),
      averagePages: booksWithPages.length > 0 ? 
        Math.round(booksWithPages.reduce((sum, b) => sum + b.pages, 0) / booksWithPages.length) : 0,
      averageRating: booksWithRating.length > 0 ?
        parseFloat((booksWithRating.reduce((sum, b) => sum + b.rating, 0) / booksWithRating.length).toFixed(1)) : 0,
      booksThisYear: books.filter(b => new Date(b.addedAt).getFullYear() === new Date().getFullYear()).length,
      booksThisMonth: books.filter(b => {
        const bookDate = new Date(b.addedAt);
        const now = new Date();
        return bookDate.getFullYear() === now.getFullYear() && 
               bookDate.getMonth() === now.getMonth();
      }).length
    };

    const genres = books.filter(b => b.genre).map(b => b.genre);
    const genreCount = {};
    genres.forEach(g => genreCount[g] = (genreCount[g] || 0) + 1);
    const favoriteGenre = Object.keys(genreCount).length > 0 ? 
      Object.keys(genreCount).reduce((a, b) => genreCount[a] > genreCount[b] ? a : b) : 'N/A';

    const authors = books.map(b => b.author);
    const authorCount = {};
    authors.forEach(a => authorCount[a] = (authorCount[a] || 0) + 1);
    const favoriteAuthor = Object.keys(authorCount).length > 0 ?
      Object.keys(authorCount).reduce((a, b) => authorCount[a] > authorCount[b] ? a : b) : 'N/A';

    const topRatedBooks = books
      .filter(b => b.rating === 5)
      .slice(0, 3)
      .map(b => ({ title: b.title, rating: b.rating }));

    return {
      library: stats,
      reading,
      preferences: {
        favoriteGenre,
        favoriteAuthor,
        topRatedBooks
      },
      timeline: {
        firstBook: books.length > 0 ? books[0].addedAt : null,
        lastBook: books.length > 0 ? books[books.length - 1].addedAt : null,
        mostProductiveDay: 'Lunes'
      }
    };
  }

  async resetDatabase(studentId) {
    const db = await this.readStudentDb(studentId);
    const deletedCount = db.books.length;
    const totalOps = db.metadata?.totalOperations || 0;
    
    const cleanDb = {
      user: db.user,
      books: [],
      metadata: {
        createdAt: db.metadata?.createdAt || new Date().toISOString(),
        lastAccess: new Date().toISOString(),
        totalOperations: 0,
        resetAt: new Date().toISOString(),
        previousOperations: totalOps
      }
    };

    await this.writeStudentDb(studentId, cleanDb);
    
    return {
      deletedBooks: deletedCount,
      totalOperations: totalOps
    };
  }
}

const db = new DatabaseManager();

// ========================================
// 🔐 MIDDLEWARE DE AUTENTICACIÓN
// ========================================

const validateStudent = (req, res, next) => {
  const studentId = req.params.student?.toUpperCase();
  
  if (!studentId || !STUDENTS[studentId]) {
    return res.status(404).json({
      error: 'Estudiante no encontrado',
      code: 'STUDENT_NOT_FOUND',
      availableStudents: Object.keys(STUDENTS)
    });
  }

  req.studentId = studentId;
  req.studentConfig = STUDENTS[studentId];
  next();
};

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token requerido. Incluye "Authorization: Bearer {token}"',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.studentId !== req.studentId) {
      return res.status(403).json({
        error: 'Token no válido para este estudiante',
        code: 'TOKEN_MISMATCH'
      });
    }

    const user = await db.getUser(req.studentId);
    if (!user || !user.active) {
      return res.status(403).json({
        error: 'Usuario no encontrado o inactivo',
        code: 'USER_INVALID'
      });
    }

    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      error: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
};

// ========================================
// 🛣️ RUTAS DE LA API
// ========================================

// 1. GET /{student}/ - Health Check
app.get('/:student', validateStudent, async (req, res) => {
  try {
    const { studentConfig, studentId } = req;
    const db_data = await db.readStudentDb(studentId);
    
    res.json({
      message: `📚 Biblioteca Personal de ${studentConfig.fullName.split(' ')[0]}`,
      student: {
        name: studentConfig.fullName,
        id: studentId,
        theme: `${studentConfig.theme.emoji} ${studentConfig.theme.theme}`,
        url: `http://localhost:${PORT}/${studentId.toLowerCase()}/`,
        color: studentConfig.theme.color
      },
      version: '1.0.0',
      totalBooks: db_data.books.length,
      endpoints: {
        public: [
          `GET /${studentId.toLowerCase()}/`,
          `POST /${studentId.toLowerCase()}/auth/register`,
          `POST /${studentId.toLowerCase()}/auth/login`
        ],
        protected: [
          `GET /${studentId.toLowerCase()}/profile`,
          `GET /${studentId.toLowerCase()}/books`,
          `POST /${studentId.toLowerCase()}/books`,
          `GET /${studentId.toLowerCase()}/books/:id`,
          `PUT /${studentId.toLowerCase()}/books/:id`,
          `DELETE /${studentId.toLowerCase()}/books/:id`,
          `GET /${studentId.toLowerCase()}/stats`,
          `DELETE /${studentId.toLowerCase()}/reset`
        ]
      },
      welcomeMessage: `¡Bienvenido a tu biblioteca personal, ${studentConfig.fullName.split(' ')[0]}! ${studentConfig.theme.emoji}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. POST /{student}/auth/register - Registro
app.post('/:student/auth/register', validateStudent, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { studentConfig, studentId } = req;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Nombre, email y password son requeridos',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await db.createUser(studentId, {
      name,
      email,
      hashedPassword
    });

    const userResponse = { ...user };
    delete userResponse.password;

    res.status(201).json({
      message: `¡Bienvenido a tu biblioteca personal, ${name.split(' ')[0]}! ${studentConfig.theme.emoji}`,
      user: userResponse,
      theme: studentConfig.theme
    });

  } catch (error) {
    if (error.message === 'Usuario ya existe') {
      return res.status(409).json({
        error: 'Ya existe un usuario registrado para este estudiante',
        code: 'USER_ALREADY_EXISTS'
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 3. POST /{student}/auth/login - Login
app.post('/:student/auth/login', validateStudent, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { studentConfig, studentId } = req;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y password son requeridos',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await db.getUser(studentId);
    if (!user) {
      return res.status(401).json({
        error: 'Usuario no encontrado. Debes registrarte primero',
        code: 'USER_NOT_FOUND'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        studentId: studentId 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      message: `¡Bienvenido de nuevo, ${user.name.split(' ')[0]}! ${studentConfig.theme.emoji}`,
      token,
      user: userResponse,
      expiresIn: '24h',
      theme: studentConfig.theme
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 4. GET /{student}/profile - Perfil
app.get('/:student/profile', validateStudent, verifyToken, async (req, res) => {
  try {
    const { user, studentConfig, studentId } = req;
    const stats = await db.getStats(studentId);

    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      user: userResponse,
      library: stats.library,
      theme: studentConfig.theme
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 5. GET /{student}/books - Listar libros
app.get('/:student/books', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const filters = req.query;
    const pagination = { page: req.query.page, limit: req.query.limit };

    const result = await db.getBooks(studentId, filters, pagination);
    
    res.json({
      ...result,
      filters: filters
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 6. POST /{student}/books - Agregar libro
app.post('/:student/books', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const bookData = req.body;

    if (!bookData.title || !bookData.author) {
      return res.status(400).json({
        error: 'Título y autor son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (bookData.status && !BOOK_STATUSES.includes(bookData.status)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${BOOK_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const book = await db.addBook(studentId, bookData);

    res.status(201).json({
      message: '¡Libro agregado exitosamente a tu biblioteca! 📚',
      book
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 7. GET /{student}/books/:id - Ver libro específico
app.get('/:student/books/:id', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const { id } = req.params;

    const book = await db.getBookById(studentId, id);
    
    if (!book) {
      return res.status(404).json({
        error: 'Libro no encontrado',
        code: 'BOOK_NOT_FOUND'
      });
    }

    res.json({ book });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 8. PUT /{student}/books/:id - Actualizar libro
app.put('/:student/books/:id', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.status && !BOOK_STATUSES.includes(updateData.status)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${BOOK_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const book = await db.updateBook(studentId, id, updateData);
    
    if (!book) {
      return res.status(404).json({
        error: 'Libro no encontrado',
        code: 'BOOK_NOT_FOUND'
      });
    }

    res.json({
      message: 'Libro actualizado exitosamente 📝',
      book
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 9. DELETE /{student}/books/:id - Eliminar libro
app.delete('/:student/books/:id', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const { id } = req.params;

    const deletedBook = await db.deleteBook(studentId, id);
    
    if (!deletedBook) {
      return res.status(404).json({
        error: 'Libro no encontrado',
        code: 'BOOK_NOT_FOUND'
      });
    }

    res.json({
      message: 'Libro eliminado de tu biblioteca 🗑️',
      deletedBook: {
        id: deletedBook.id,
        title: deletedBook.title,
        author: deletedBook.author
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 10. GET /{student}/stats - Estadísticas
app.get('/:student/stats', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentConfig, studentId } = req;
    const stats = await db.getStats(studentId);

    res.json({
      student: {
        name: studentConfig.fullName,
        theme: `${studentConfig.theme.emoji} ${studentConfig.theme.theme}`
      },
      ...stats
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 11. DELETE /{student}/reset - Resetear base de datos
app.delete('/:student/reset', validateStudent, verifyToken, async (req, res) => {
  try {
    const { studentId } = req;
    const { confirmReset, confirmation } = req.body;

    if (!confirmReset || confirmReset !== true) {
      return res.status(400).json({
        error: 'Debes confirmar el reseteo con "confirmReset: true"',
        code: 'CONFIRMATION_REQUIRED'
      });
    }

    if (!confirmation || confirmation !== 'DELETE_ALL_MY_DATA') {
      return res.status(400).json({
        error: 'Debes incluir "confirmation: DELETE_ALL_MY_DATA"',
        code: 'INVALID_CONFIRMATION'
      });
    }

    const result = await db.resetDatabase(studentId);

    res.json({
      message: '🚨 Base de datos completamente reseteada',
      warning: 'Todos tus libros han sido eliminados permanentemente',
      student: studentId,
      resetAt: new Date().toISOString(),
      deletedItems: result,
      nextStep: 'Puedes comenzar a agregar libros nuevamente'
    });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ========================================
// 🚀 SERVIDOR
// ========================================

// Ruta raíz informativa
app.get('/', (req, res) => {
  res.json({
    message: '📚 API Biblioteca Personal - QA Testing',
    version: '1.0.0',
    students: Object.keys(STUDENTS),
    endpoints: Object.keys(STUDENTS).map(student => 
      `http://localhost:${PORT}/${student.toLowerCase()}/`
    ),
    documentation: 'Cada estudiante tiene su propia API independiente',
    timestamp: new Date().toISOString()
  });
});

// Middleware de error 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    code: 'NOT_FOUND',
    availableStudents: Object.keys(STUDENTS),
    hint: 'Verifica que la URL incluya un estudiante válido: /argenis/, /caleb/, etc.'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 =======================================');
  console.log('📚 API BIBLIOTECA PERSONAL - QA TESTING');
  console.log('🚀 =======================================');
  console.log('');
  console.log(`🌐 Servidor corriendo en: http://localhost:${PORT}`);
  console.log('');
  console.log('👥 Estudiantes disponibles:');
  Object.entries(STUDENTS).forEach(([key, student]) => {
    console.log(`   ${student.theme.emoji} ${key}: http://localhost:${PORT}/${key.toLowerCase()}/`);
  });
  console.log('');
  console.log('📖 Endpoints principales por estudiante:');
  console.log('   • GET /{student}/              - Health check');
  console.log('   • POST /{student}/auth/register - Registro');
  console.log('   • POST /{student}/auth/login    - Login');
  console.log('   • GET /{student}/books          - Listar libros');
  console.log('   • POST /{student}/books         - Agregar libro');
  console.log('   • GET /{student}/stats          - Estadísticas');
  console.log('');
  console.log('✨ ¡API lista para testing con Postman!');
  console.log('');
});