import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from 'mongoose';

// ---------- Setup Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.join(__dirname, 'routes');
const modelsDir = path.join(__dirname, 'models');
const outputFile = path.join(__dirname, 'swagger-output.json');

// ---------- Load Mongoose Models ----------
const definitions = {};
const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

for (const file of modelFiles) {
  const modelPath = path.join(modelsDir, file);
  const modelModule = await import(pathToFileURL(modelPath).href);

  for (const key of Object.keys(modelModule)) {
    const model = modelModule[key];
    if (model?.schema instanceof mongoose.Schema) {
      definitions[model.modelName] = mongooseSchemaToSwagger(model.schema);
    }
  }
}

function mongooseSchemaToSwagger(schema) {
  const props = {};
  for (const [key, val] of Object.entries(schema.paths)) {
    if (key === '__v') continue; // Skip internal version key
    const type = val.instance?.toLowerCase() || 'string';
    props[key] = { type };
    if (key === '_id') {
      props[key] = { type: 'string', description: 'MongoDB ObjectId', example: '507f1f77bcf86cd799439011' };
    } else if (key === 'email') {
      props[key].format = 'email';
      props[key].example = 'user@example.com';
    } else if (key === 'password') {
      props[key].format = 'password';
      props[key].example = 'password123';
    } else if (key === 'role') {
      props[key].example = 'user';
    } else if (key === 'resetOTP') {
      props[key] = {
        type: 'object',
        properties: {
          code: { type: 'string', example: '123456' },
          expiresAt: { type: 'string', format: 'date-time', example: '2025-08-08T12:33:00.000Z' }
        }
      };
    }
  }
  return { type: 'object', properties: props };
}

// ---------- Predefined Endpoint Metadata ----------
const endpointMetadata = {
  '/login': {
    post: {
      summary: 'User Login',
      description: 'Authenticates a user with email and password, returning user details.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' },
                password: { type: 'string', format: 'password', example: 'password123' }
              }
            },
            example: {
              email: 'user@example.com',
              password: 'password123'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Login successful' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                      email: { type: 'string', format: 'email', example: 'user@example.com' },
                      role: { type: 'string', example: 'user' }
                    }
                  }
                }
              },
              example: {
                success: true,
                message: 'Login successful',
                user: {
                  id: '507f1f77bcf86cd799439011',
                  email: 'user@example.com',
                  role: 'user'
                }
              }
            }
          }
        },
        400: { description: 'Bad request (missing email or password)' },
        401: { description: 'Invalid email or password' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/request-reset': {
    post: {
      summary: 'Request Password Reset',
      description: 'Sends a one-time password (OTP) to the user’s email for password reset.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' }
              }
            },
            example: {
              email: 'user@example.com'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP sent successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP sent to your email' }
                }
              },
              example: {
                success: true,
                message: 'OTP sent to your email'
              }
            }
          }
        },
        400: { description: 'Bad request (missing email)' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/verify-otp': {
    post: {
      summary: 'Verify OTP',
      description: 'Verifies the OTP sent to the user’s email and returns a reset token for password reset.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'otp'],
              properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' },
                otp: { type: 'string', example: '123456' }
              }
            },
            example: {
              email: 'user@example.com',
              otp: '123456'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP verified successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'OTP verified successfully' },
                  resetToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                }
              },
              example: {
                success: true,
                message: 'OTP verified successfully',
                resetToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
            }
          }
        },
        400: { description: 'Bad request (missing email/OTP, no OTP requested, expired OTP, or invalid OTP)' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/reset-password': {
    post: {
      summary: 'Reset Password',
      description: 'Resets the user’s password using a valid reset token obtained from OTP verification.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['resetToken', 'newPassword'],
              properties: {
                resetToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                newPassword: { type: 'string', format: 'password', example: 'newPassword123' }
              }
            },
            example: {
              resetToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              newPassword: 'newPassword123'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Password reset successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: 'Password reset successful' }
                }
              },
              example: {
                success: true,
                message: 'Password reset successful'
              }
            }
          }
        },
        400: { description: 'Bad request (missing token or password)' },
        401: { description: 'Invalid or expired reset token, or invalid token purpose' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/send-otp': {
    post: {
      summary: 'Send OTP',
      description: 'Sends a one-time password (OTP) to the user’s mobile number and returns user status.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile'],
              properties: {
                mobile: { type: 'string', example: '+1234567890', description: 'User’s mobile number' }
              }
            },
            example: {
              mobile: '+1234567890'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP sent successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'OTP sent successfully' },
                  userStatus: {
                    type: 'object',
                    properties: {
                      isNewUser: { type: 'boolean', example: true },
                      role: { type: 'string', example: 'student', enum: ['student', 'teacher', null] },
                      isApproved: { type: 'boolean', example: false },
                      rejected: { type: 'boolean', example: false },
                      paymentStatus: { type: 'string', example: 'pending', enum: ['pending', 'completed'] }
                    }
                  }
                }
              },
              example: {
                message: 'OTP sent successfully',
                userStatus: {
                  isNewUser: true,
                  role: null,
                  isApproved: false,
                  rejected: false,
                  paymentStatus: 'pending'
                }
              }
            }
          }
        },
        400: { description: 'Bad request (invalid mobile number)' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/verify-otp': {
    post: {
      summary: 'Verify OTP',
      description: 'Verifies the OTP sent to the user’s mobile and generates a JWT token, returning user details.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['mobile', 'otp'],
              properties: {
                mobile: { type: 'string', example: '+1234567890', description: 'User’s mobile number' },
                otp: { type: 'string', example: '1234', description: 'One-time password' }
              }
            },
            example: {
              mobile: '+1234567890',
              otp: '1234'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OTP verified successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'OTP verified' },
                  isNewUser: { type: 'boolean', example: true },
                  userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  userType: { type: 'string', example: 'student_approved', enum: ['student_approved', 'student_pending', 'student_rejected', 'teacher_approved', 'teacher_pending', 'teacher_rejected', 'new'] },
                  userDetails: { type: 'object', additionalProperties: true },
                  token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                }
              },
              example: {
                message: 'OTP verified',
                isNewUser: true,
                userId: '507f1f77bcf86cd799439011',
                userType: 'new',
                userDetails: {
                  userId: '507f1f77bcf86cd799439011',
                  mobile: '+1234567890',
                  role: 'new'
                },
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
            }
          }
        },
        400: { description: 'Invalid OTP or bad request' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/user/{userId}': {
    get: {
      summary: 'Get User Details',
      description: 'Retrieves user details based on the user ID and their role.',
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '507f1f77bcf86cd799439011' },
          description: 'MongoDB ObjectId of the user'
        }
      ],
      responses: {
        200: {
          description: 'User details retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'User details retrieved successfully' },
                  userDetails: { type: 'object', additionalProperties: true }
                }
              },
              example: {
                message: 'User details retrieved successfully',
                userDetails: {
                  userId: '507f1f77bcf86cd799439011',
                  mobile: '+1234567890',
                  role: 'student',
                  paymentStatus: 'pending',
                  title: 'Mr',
                  firstName: 'John',
                  lastName: 'Doe',
                  gender: 'male',
                  email: 'john.doe@example.com',
                  pinCode: '123456',
                  state: 'California'
                }
              }
            }
          }
        },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      },
      security: [{ bearerAuth: [] }]
    }
  },
  '/select-role': {
    post: {
      summary: 'Select User Role',
      description: 'Sets or updates the user’s role (e.g., teacher or student) and initializes role-specific documents.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'role'],
              properties: {
                userId: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'MongoDB ObjectId of the user' },
                role: { type: 'string', example: 'student', enum: ['student', 'teacher'], description: 'User role' }
              }
            },
            example: {
              userId: '507f1f77bcf86cd799439011',
              role: 'student'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Role set successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Role set to student' },
                  userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  userDetails: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                      mobile: { type: 'string', example: '+1234567890' },
                      role: { type: 'string', example: 'student' }
                    }
                  },
                  token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                }
              },
              example: {
                message: 'Role set to student',
                userId: '507f1f77bcf86cd799439011',
                userDetails: {
                  userId: '507f1f77bcf86cd799439011',
                  mobile: '+1234567890',
                  role: 'student'
                },
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
            }
          }
        },
        400: { description: 'Bad request (invalid userId or role)' },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      }
    }
  },
  '/payment': {
    post: {
      summary: 'Process Payment',
      description: 'Processes a payment for a teacher and updates their payment status.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId'],
              properties: {
                userId: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'MongoDB ObjectId of the user (must be a teacher)' }
              }
            },
            example: {
              userId: '507f1f77bcf86cd799439011'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Payment successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Payment successful' },
                  paymentStatus: { type: 'string', example: 'completed', enum: ['pending', 'completed'] }
                }
              },
              example: {
                message: 'Payment successful',
                paymentStatus: 'completed'
              }
            }
          }
        },
        400: { description: 'Bad request (invalid user or role)' },
        404: { description: 'Teacher not found' },
        500: { description: 'Internal server error' }
      },
      security: [{ bearerAuth: [] }]
    }
  },
  '/check-teacher-approval/{userId}': {
    get: {
      summary: 'Check Teacher Approval Status',
      description: 'Checks the approval status of a teacher and determines the next screen to display.',
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '507f1f77bcf86cd799439011' },
          description: 'MongoDB ObjectId of the user'
        }
      ],
      responses: {
        200: {
          description: 'Teacher approval status retrieved',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isApproved: { type: 'boolean', example: true },
                  rejected: { type: 'boolean', example: false },
                  nextScreen: { type: 'string', example: 'teacher-dashboard', enum: ['teacher-dashboard', 'teacher-approval-pending', 'teacher-rejected', 'payment-screen'] },
                  message: { type: 'string', example: 'Welcome to the dashboard!' },
                  paymentStatus: { type: 'string', example: 'completed', enum: ['pending', 'completed'] },
                  userDetails: { type: 'object', additionalProperties: true }
                }
              },
              example: {
                isApproved: true,
                rejected: false,
                nextScreen: 'teacher-dashboard',
                message: 'Welcome to the dashboard!',
                paymentStatus: 'completed',
                userDetails: {
                  userId: '507f1f77bcf86cd799439011',
                  mobile: '+1234567890',
                  role: 'teacher',
                  paymentStatus: 'completed',
                  title: 'Mr',
                  name: 'John Doe',
                  gender: 'male',
                  email: 'john.doe@example.com',
                  pinCode: '123456',
                  state: 'California',
                  instituteName: 'Example Institute',
                  qualification: 'PhD',
                  experience: 5,
                  bio: 'Experienced educator',
                  avatar: 'https://example.com/avatar.jpg',
                  termsAccepted: true,
                  isApproved: true,
                  rejected: false
                }
              }
            }
          }
        },
        400: { description: 'Bad request (invalid user or role)' },
        404: { description: 'Teacher not found' },
        500: { description: 'Internal server error' }
      },
      security: [{ bearerAuth: [] }]
    }
  },
  '/welcome/{userId}': {
    get: {
      summary: 'Welcome User',
      description: 'Welcomes the user and provides a redirect URL based on their role.',
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '507f1f77bcf86cd799439011' },
          description: 'MongoDB ObjectId of the user'
        }
      ],
      responses: {
        200: {
          description: 'Welcome message with redirect URL',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Welcome!' },
                  redirect: { type: 'string', example: '/student-dashboard' }
                }
              },
              example: {
                message: 'Welcome!',
                redirect: '/student-dashboard'
              }
            }
          }
        },
        404: { description: 'User not found' },
        500: { description: 'Internal server error' }
      },
      security: [{ bearerAuth: [] }]
    }
  },
  '/student-details': {
    post: {
      summary: 'Submit Student Details',
      description: 'Submits or updates student details for a user with the "student" role.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['userId', 'title', 'firstName', 'lastName', 'gender', 'email', 'pinCode', 'state'],
              properties: {
                userId: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'MongoDB ObjectId of the user' },
                title: { type: 'string', example: 'Mr', description: 'Title (e.g., Mr, Ms)' },
                firstName: { type: 'string', example: 'John', description: 'Student’s first name' },
                lastName: { type: 'string', example: 'Doe', description: 'Student’s last name' },
                gender: { type: 'string', example: 'male', enum: ['male', 'female', 'other'], description: 'Gender' },
                email: { type: 'string', format: 'email', example: 'john.doe@example.com', description: 'Email address' },
                pinCode: { type: 'string', example: '123456', description: 'Postal code' },
                state: { type: 'string', example: 'California', description: 'State name' }
              }
            },
            example: {
              userId: '507f1f77bcf86cd799439011',
              title: 'Mr',
              firstName: 'John',
              lastName: 'Doe',
              gender: 'male',
              email: 'john.doe@example.com',
              pinCode: '123456',
              state: 'California'
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Student details submitted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Student details submitted' },
                  student: { type: 'object', additionalProperties: true }
                }
              },
              example: {
                message: 'Student details submitted',
                student: {
                  userId: '507f1f77bcf86cd799439011',
                  title: 'Mr',
                  firstName: 'John',
                  lastName: 'Doe',
                  gender: 'male',
                  email: 'john.doe@example.com',
                  pinCode: '123456',
                  state: 'California',
                  mobile: '+1234567890',
                  avatar: null,
                  avatarUrl: null,
                  termsAccepted: false,
                  paymentStatus: 'pending',
                  tutorialViewed: false,
                  classId: null,
                  className: null,
                  boardId: null,
                  boardName: null,
                  schoolName: null,
                  uid: null
                }
              }
            }
          }
        },
        400: { description: 'Bad request (invalid user or role)' },
        500: { description: 'Internal server error' }
      },
      security: [{ bearerAuth: [] }]
    }
  },
  '/get-subjects': {
    post: {
      summary: 'Get Subjects for Classes',
      description: 'Retrieves subjects associated with the provided class IDs.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['classIds'],
              properties: {
                classIds: {
                  type: 'array',
                  items: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  description: 'Array of MongoDB ObjectIds for classes'
                }
              }
            },
            example: {
              classIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Subjects retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  subjects: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Subject' }
                  }
                }
              },
              example: {
                subjects: [
                  {
                    _id: '507f1f77bcf86cd799439013',
                    name: 'Mathematics',
                    class: '507f1f77bcf86cd799439011'
                  },
                  {
                    _id: '507f1f77bcf86cd799439014',
                    name: 'Science',
                    class: '507f1f77bcf86cd799439011'
                  }
                ]
              }
            }
          }
        },
        400: { description: 'Bad request (classIds must be a non-empty array)' },
        500: { description: 'Internal server error' }
      }
    }
  }
};

// ---------- Scan Routes ----------
const paths = {};
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of routeFiles) {
  const routeFile = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  const regex = /router\.(get|post|put|delete)\(['"`](.*?)['"`]/g;
  let match;
  while ((match = regex.exec(routeFile)) !== null) {
    const method = match[1];
    const routePath = match[2];

    // Use predefined metadata if available, otherwise generate dynamically
    const modelName = guessModelFromPath(routePath);
    const metadata = endpointMetadata[routePath]?.[method] || {
      summary: autoTitle(method, modelName, routePath),
      description: autoDescription(method, modelName, routePath),
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: modelName && definitions[modelName]
                ? { $ref: `#/components/schemas/${modelName}` }
                : { type: 'object' }
            }
          }
        },
        400: { description: 'Bad request' },
        500: { description: 'Internal server error' }
      }
    };

    // Add requestBody for POST/PUT if not predefined
    if ((method === 'post' || method === 'put') && !metadata.requestBody) {
      metadata.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: modelName && definitions[modelName]
              ? { $ref: `#/components/schemas/${modelName}` }
              : { type: 'object' }
          }
        }
      };
    }

    paths[routePath] = paths[routePath] || {};
    paths[routePath][method] = metadata;
  }
}

function guessModelFromPath(routePath) {
  const candidates = Object.keys(definitions);
  for (const name of candidates) {
    if (routePath.toLowerCase().includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

function autoTitle(method, modelName, routePath) {
  const action = {
    get: 'Retrieve',
    post: 'Create',
    put: 'Update',
    delete: 'Delete'
  }[method];
  return modelName ? `${action} ${modelName}` : `${action} ${routePath.split('/').pop().replace(/-/g, ' ')} Resource`;
}

function autoDescription(method, modelName, routePath) {
  const action = {
    get: 'Retrieves',
    post: 'Creates',
    put: 'Updates',
    delete: 'Deletes'
  }[method];
  return modelName ? `${action} a ${modelName} resource` : `${action} a resource at ${routePath}`;
}

// ---------- Build OpenAPI 3.0.3 Doc ----------
const doc = {
  openapi: '3.0.3',
  info: {
    title: 'Authentication API',
    description: 'API for user authentication, including login, password reset request, OTP verification, and password reset.',
    version: '1.0.0'
  },
  servers: [
    { url: 'http://localhost:5000/api' }
  ],
  paths,
  components: {
    schemas: definitions
  }
};

// ---------- Save ----------
fs.writeFileSync(outputFile, JSON.stringify(doc, null, 2));
console.log(`✅ Swagger documentation generated at ${outputFile}`);