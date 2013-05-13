//
// Copyright (c) 2012 The ANGLE Project Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//

#ifndef COMPILER_PREPROCESSOR_TOKENIZER_H_
#define COMPILER_PREPROCESSOR_TOKENIZER_H_

#include "Input.h"
#include "Lexer.h"
#include "pp_utils.h"

namespace pp
{

class Diagnostics;

class Tokenizer : public Lexer
{
  public:
    struct Context
    {
        Diagnostics* diagnostics;

        Input input;
        // The location where yytext points to. Token location should track
        // scanLoc instead of Input::mReadLoc because they may not be the same
        // if text is buffered up in the scanner input buffer.
        Input::Location scanLoc;

        bool leadingSpace;
        bool lineStart;
    };
    static const std::size_t kMaxTokenLength;

    Tokenizer(Diagnostics* diagnostics);
    ~Tokenizer();

    bool init(int count, const char* const string[], const int length[]);

    void setFileNumber(int file);
    void setLineNumber(int line);

    virtual void lex(Token* token);

  private:
    PP_DISALLOW_COPY_AND_ASSIGN(Tokenizer);
    bool initScanner();
    void destroyScanner();

    void* mHandle;  // Scanner handle.
    Context mContext;  // Scanner extra.
};

}  // namespace pp
#endif  // COMPILER_PREPROCESSOR_TOKENIZER_H_

