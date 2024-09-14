import express, { response } from 'express';

const router = express.Router();

router.get("/signup", (req, res) => {
  res.send('SignUp browser is ready');
});

router.get("/login", (req, res) => {
  res.send('login route called');
})

router.get("/logout", (req, res) => {
  res.send('Signup route called');
})

export default router;